import { readFileSync } from 'node:fs';
import {
  resolveCache,
  resolvePubSub,
  resolveQueue,
  resolveSession
} from './adapters/index';
import type {
  CacheAdapter,
  PubSubAdapter,
  QueueAdapter,
  SessionAdapter,
  SumacOpts
} from './adapters/types';
import { type BaseCtx, buildCtx, parseBody, parseQuery } from './context';
import { HttpError } from './errors';
import { type AnyMiddleware, compileChain } from './middleware';
import { compilePattern, type RouteOpts, type Router } from './router';
import { type AnySchema, errors, validate } from './schema';

type ProviderEntry = {
  factory: (ctx: any) => unknown;
  dispose?: (instance: unknown) => void | Promise<void>;
  instance?: unknown;
  instantiated: boolean;
};

type JobSpec = {
  payload?: AnySchema;
  retries?: number;
  backoff?: 'fixed' | 'exponential';
};

export type Module = {
  route: string;
  routers: Router<any>[];
  jobs?: Record<
    string,
    JobSpec & { handler: (ctx: any, data: any) => Promise<void> }
  >;
  events?: Record<string, (ctx: any, payload: any) => Promise<void>>;
};

type JobEntry = {
  handler: (ctx: any, payload: any) => Promise<void>;
  opts: { retries?: number; backoff?: 'fixed' | 'exponential' };
};

type EventHandler = (ctx: any, payload: any) => Promise<void>;

type CompiledRoute = {
  method: string;
  regex: RegExp;
  keys: string[];
  pattern: string;
  opts: RouteOpts;
  execute: (ctx: any) => Promise<Response>;
  catchHandler?: (ctx: any, err: Error) => Promise<Response | undefined>;
  _internal?: boolean;
};

const INTERNAL_URL = new URL('http://internal');

export class Sumac<Ctx extends BaseCtx = BaseCtx> {
  private readonly _config: SumacOpts;
  private readonly _providers = new Map<string, ProviderEntry>();
  private readonly _derivations: ((
    ctx: any
  ) => Record<string, unknown> | Promise<Record<string, unknown>>)[] = [];
  private readonly _globalMiddleware: AnyMiddleware[] = [];
  private readonly _routes: CompiledRoute[] = [];
  private readonly _jobs = new Map<string, JobEntry>();
  private readonly _events = new Map<string, EventHandler[]>();
  private _errorHandler?: (
    ctx: any,
    err: Error
  ) => Promise<Response | undefined>;
  private _cache!: CacheAdapter;
  private _session!: SessionAdapter;
  private _queue!: QueueAdapter;
  private _pubsub!: PubSubAdapter;
  private _providerNames = new Set<string>();
  private _initialized = false;

  constructor(config: SumacOpts = {}) {
    this._config = config;
    this._loadEnv();
  }

  private _loadEnv() {
    try {
      const lines = readFileSync('.env', 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        )
          val = val.slice(1, -1);
        if (key && !(key in process.env)) process.env[key] = val;
      }
    } catch {
      /* no .env file */
    }
  }

  private readonly _getProvider = (k: string, ctx: any): unknown => {
    const entry = this._providers.get(k);
    if (!entry) return undefined;
    if (!entry.instantiated) {
      entry.instance = entry.factory(ctx);
      entry.instantiated = true;
    }
    return entry.instance;
  };

  private init() {
    if (this._initialized) return;
    this._initialized = true;
    this._cache = resolveCache(this._config.cache);
    this._session = resolveSession(this._config.session);
    this._queue = resolveQueue(this._config.queue);
    this._pubsub = resolvePubSub(this._config.pubsub);
    this._providerNames = new Set(this._providers.keys());

    for (const [name, job] of this._jobs) {
      const { retries = 0, backoff = 'fixed' } = job.opts;
      this._queue.process(name, async (payload) => {
        const ctx = await this._buildCtx(
          new Request('http://internal'),
          INTERNAL_URL,
          '(job)',
          {}
        );
        for (let attempt = 0; ; attempt++) {
          try {
            await job.handler(ctx, payload);
            return;
          } catch (err) {
            if (attempt >= retries) throw err;
            const delay =
              backoff === 'exponential' ? 1000 * 2 ** attempt : 1000;
            await new Promise<void>((r) => setTimeout(r, delay));
          }
        }
      });
    }

    for (const [event, handlers] of this._events) {
      this._pubsub.subscribe(event, async (payload) => {
        for (const h of handlers) {
          const ctx = await this._buildCtx(
            new Request('http://internal'),
            INTERNAL_URL,
            '(event)',
            {}
          );
          await h(ctx, payload);
        }
      });
    }
  }

  private async _buildCtx(
    request: Request,
    url: URL,
    route: string,
    params: Record<string, string>,
    routeOpts: RouteOpts = {}
  ) {
    const body = await parseBody(request, routeOpts.body);
    const query = parseQuery(url, routeOpts.query);

    if (routeOpts.params && !validate(routeOpts.params, params))
      throw new HttpError(
        400,
        'Path parameter validation failed',
        errors(routeOpts.params, params)
      );

    if (routeOpts.headers) {
      const hdrObj: Record<string, string> = {};
      for (const [k, v] of request.headers) hdrObj[k.toLowerCase()] = v;
      if (!validate(routeOpts.headers, hdrObj))
        throw new HttpError(
          400,
          'Header validation failed',
          errors(routeOpts.headers, hdrObj)
        );
    }

    const derivedValues: Record<string, unknown> = {};

    const ctx = buildCtx({
      request,
      url,
      route,
      params,
      body,
      query,
      cache: this._cache,
      session: this._session,
      queue: this._queue,
      pubsub: this._pubsub,
      getProvider: this._getProvider,
      providerNames: this._providerNames,
      derivedValues
    });

    for (const derive of this._derivations) {
      Object.assign(derivedValues, await derive(ctx));
    }

    return ctx;
  }

  provide<K extends string, V>(
    name: K,
    factory: (ctx: Ctx) => V,
    opts?: { dispose?: (instance: V) => void }
  ): Sumac<Ctx & Record<K, V>> {
    this._providers.set(name, {
      factory: factory as any,
      dispose: opts?.dispose as any,
      instantiated: false
    });
    return this as any;
  }

  derive<R extends Record<string, unknown>>(
    fn: (ctx: Ctx) => R | Promise<R>
  ): Sumac<Ctx & R> {
    this._derivations.push(fn as any);
    return this as any;
  }

  use(...middlewares: AnyMiddleware[]): this {
    this._globalMiddleware.push(...middlewares);
    return this;
  }

  private _mountRouter(prefix: string, router: Router<any>): void {
    const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    for (const route of router._routes) {
      const fullPattern = route.pattern === '/' ? p : p + route.pattern;
      const { regex, keys } = compilePattern(fullPattern);
      const allMiddleware = [
        ...this._globalMiddleware,
        ...route.routerMiddleware,
        ...(route.opts.use ?? [])
      ];
      this._routes.push({
        method: route.method,
        regex,
        keys,
        pattern: fullPattern,
        opts: route.opts,
        execute: compileChain(allMiddleware, route.handler),
        catchHandler: router._catchHandler
      });
    }
  }

  modules(...modules: Module[]): this {
    for (const { route, routers, jobs, events } of modules) {
      for (const r of routers) this._mountRouter(route, r);
      if (jobs)
        for (const [name, { handler, ...opts }] of Object.entries(jobs))
          this._jobs.set(name, { handler, opts });
      if (events)
        for (const [event, handler] of Object.entries(events))
          this._events.set(event, [
            ...(this._events.get(event) ?? []),
            handler
          ]);
    }
    return this;
  }

  jobs(
    definitions: Record<
      string,
      JobSpec & { handler: (ctx: Ctx, data: any) => Promise<void> }
    >
  ): this {
    for (const [name, { handler, ...opts }] of Object.entries(definitions))
      this._jobs.set(name, { handler: handler as any, opts });
    return this;
  }

  events(
    handlers: Record<string, (ctx: Ctx, payload: any) => Promise<void>>
  ): this {
    for (const [event, handler] of Object.entries(handlers))
      this._events.set(event, [
        ...(this._events.get(event) ?? []),
        handler as any
      ]);
    return this;
  }

  catch(
    handler: (ctx: Ctx, err: Error) => Promise<Response | undefined>
  ): this {
    this._errorHandler = handler as any;
    return this;
  }

  private _toJsonSchema(schema: unknown): unknown {
    if (!schema || typeof schema !== 'object') return schema;
    if (Array.isArray(schema)) return schema.map((s) => this._toJsonSchema(s));
    const s = schema as Record<string, unknown>;
    if (s._optional) return this._toJsonSchema(s._inner);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      if (k.startsWith('_')) continue;
      result[k] = this._toJsonSchema(v);
    }
    return result;
  }

  openApi(path = '/openapi.json'): this {
    if (process.env.NODE_ENV === 'production') return this;
    const { regex, keys } = compilePattern(path);
    const handler = async () =>
      new Response(JSON.stringify(this.openApiSpec()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    this._routes.push({
      method: 'GET',
      regex,
      keys,
      pattern: path,
      opts: {},
      execute: compileChain([...this._globalMiddleware], handler),
      _internal: true
    });
    return this;
  }

  openApiSpec() {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const route of this._routes) {
      if (route._internal) continue;
      const p = route.pattern.replace(/:(\w+)/g, '{$1}');
      const method = route.method.toLowerCase();
      if (!paths[p]) paths[p] = {};

      const queryParams = route.opts.query
        ? (() => {
            const qs = route.opts.query as Record<string, unknown>;
            const props =
              (qs.properties as Record<string, unknown> | undefined) ?? {};
            const required = (qs.required as string[] | undefined) ?? [];
            return Object.entries(props).map(([name, schema]) => ({
              name,
              in: 'query',
              required: required.includes(name),
              schema: this._toJsonSchema(schema)
            }));
          })()
        : [];

      paths[p][method] = {
        parameters: [
          ...route.keys.map((k) => ({
            name: k,
            in: 'path',
            required: true,
            schema: { type: 'string' }
          })),
          ...queryParams
        ],
        ...(route.opts.body && {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: this._toJsonSchema(route.opts.body)
              }
            }
          }
        }),
        responses: route.opts.response
          ? Object.fromEntries(
              Object.entries(route.opts.response).map(([s, sc]) => [
                s,
                {
                  content: {
                    'application/json': { schema: this._toJsonSchema(sc) }
                  }
                }
              ])
            )
          : { '200': { description: 'Success' } }
      };
    }
    return {
      openapi: '3.1.0',
      info: { title: 'Sumac API', version: '1.0.0' },
      paths
    };
  }

  async fetch(request: Request): Promise<Response> {
    this.init();

    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    let matched: CompiledRoute | undefined;
    let matchResult: RegExpMatchArray | null = null;
    let headFallback = false;

    for (const route of this._routes) {
      if (route.method !== method) continue;
      const m = url.pathname.match(route.regex);
      if (m) {
        matched = route;
        matchResult = m;
        break;
      }
    }

    if (!matched && method === 'HEAD') {
      headFallback = true;
      for (const route of this._routes) {
        if (route.method !== 'GET') continue;
        const m = url.pathname.match(route.regex);
        if (m) {
          matched = route;
          matchResult = m;
          break;
        }
      }
    }

    if (!matched || !matchResult) {
      const allowed = this._routes
        .filter((r) => !r._internal && url.pathname.match(r.regex))
        .map((r) => r.method);
      if (allowed.length > 0) {
        if (allowed.includes('GET') && !allowed.includes('HEAD'))
          allowed.push('HEAD');
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            Allow: allowed.join(', ')
          }
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < matched.keys.length; i++)
      params[matched.keys[i]] = decodeURIComponent(matchResult[i + 1]);

    let ctx: BaseCtx | undefined;
    try {
      ctx = await this._buildCtx(
        request,
        url,
        matched.pattern,
        params,
        matched.opts
      );
      const res = await matched.execute(ctx);
      if (headFallback)
        return new Response(null, { status: res.status, headers: res.headers });
      return res;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (matched.catchHandler && ctx) {
        try {
          const res = await matched.catchHandler(ctx, error);
          if (res) return res;
        } catch {
          /* fall through */
        }
      }

      if (this._errorHandler && ctx) {
        try {
          const res = await this._errorHandler(ctx, error);
          if (res) return res;
        } catch {
          /* fall through */
        }
      }

      if (err instanceof HttpError) {
        return new Response(
          JSON.stringify({
            error: err.message,
            ...(err.issues != null ? { issues: err.issues } : {})
          }),
          {
            status: err.status,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (ctx)
        ctx.log.error({ message: error.message, route: matched.pattern });

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async dispose() {
    for (const [, entry] of [...this._providers.entries()].reverse()) {
      if (entry.dispose && entry.instantiated && entry.instance !== undefined) {
        await entry.dispose(entry.instance);
      }
    }
  }
}
