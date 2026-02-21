import type {
  CacheAdapter,
  PubSubAdapter,
  QueueAdapter,
  SessionAdapter
} from './adapters/types';
import { HttpError } from './errors';
import type { AnySchema } from './schema';
import { errors, validate } from './schema';

export type Logger = {
  info(data: Record<string, unknown> | string): void;
  error(data: Record<string, unknown> | string): void;
  warn(data: Record<string, unknown> | string): void;
  debug(data: Record<string, unknown> | string): void;
};

export type CookieOpts = {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
};

export type CookieJar = {
  get(name: string): string | undefined;
  set(name: string, value: string, opts?: CookieOpts): void;
  delete(name: string): void;
  readonly _setCookies: string[];
};

export type BaseCtx = {
  request: Request;
  headers: Headers;
  method: string;
  url: URL;
  route: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  body: unknown;
  ip: string;
  log: Logger;
  cookies: CookieJar;
  cache: CacheAdapter;
  session: SessionAdapter;
  queue: QueueAdapter;
  pubsub: PubSubAdapter;
  json(status: number, data: unknown): Response;
  error(status: number, message?: string): Response;
  redirect(url: string, status?: number): Response;
};

const createLogger = (traceId: string): Logger => {
  const log = (level: string) => (data: Record<string, unknown> | string) =>
    console.log(
      JSON.stringify({
        level,
        traceId,
        ...(typeof data === 'string' ? { message: data } : data)
      })
    );
  return {
    info: log('info'),
    error: log('error'),
    warn: log('warn'),
    debug: log('debug')
  };
};

const parseCookies = (header: string | null): Record<string, string> => {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p.length >= 2)
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('=').trim())])
  );
};

const createCookieJar = (request: Request): CookieJar => {
  const parsed = parseCookies(request.headers.get('cookie'));
  const setCookies: string[] = [];
  return {
    get: (name) => parsed[name],
    set: (name, value, opts = {}) => {
      let c = `${name}=${encodeURIComponent(value)}`;
      if (opts.maxAge !== undefined) c += `; Max-Age=${opts.maxAge}`;
      if (opts.expires) c += `; Expires=${opts.expires.toUTCString()}`;
      if (opts.httpOnly) c += '; HttpOnly';
      if (opts.secure) c += '; Secure';
      if (opts.sameSite) c += `; SameSite=${opts.sameSite}`;
      if (opts.path) c += `; Path=${opts.path}`;
      if (opts.domain) c += `; Domain=${opts.domain}`;
      setCookies.push(c);
    },
    delete: (name) => setCookies.push(`${name}=; Max-Age=0; Path=/`),
    get _setCookies() {
      return setCookies;
    }
  };
};

export const parseBody = async (
  request: Request,
  schema?: AnySchema
): Promise<unknown> => {
  const ct = request.headers.get('content-type') ?? '';
  if (request.method === 'GET' || request.method === 'HEAD' || !request.body)
    return undefined;

  let body: unknown;
  if (ct.includes('application/json')) {
    body = await request.json();
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(await request.text()));
  } else if (ct.includes('multipart/form-data')) {
    body = Object.fromEntries(await request.formData());
  } else {
    body = await request.text();
  }

  if (schema && body !== undefined && !validate(schema, body)) {
    throw new HttpError(
      400,
      'Request body validation failed',
      errors(schema, body)
    );
  }

  return body;
};

export const parseQuery = (
  url: URL,
  schema?: AnySchema
): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams) {
    const existing = query[k];
    query[k] =
      existing === undefined
        ? v
        : Array.isArray(existing)
          ? [...existing, v]
          : [existing, v];
  }
  if (schema && !validate(schema, query)) {
    throw new HttpError(
      400,
      'Query parameter validation failed',
      errors(schema, query)
    );
  }
  return query;
};

type BuildCtxOpts = {
  request: Request;
  url: URL;
  route: string;
  params: Record<string, string>;
  body: unknown;
  query: Record<string, string | string[]>;
  cache: CacheAdapter;
  session: SessionAdapter;
  queue: QueueAdapter;
  pubsub: PubSubAdapter;
  getProvider: (key: string, ctx: any) => unknown;
  providerNames: Set<string>;
  derivedValues: Record<string, unknown>;
};

export const buildCtx = (init: BuildCtxOpts): BaseCtx => {
  const {
    request,
    url,
    route,
    params,
    body,
    query,
    cache,
    session,
    queue,
    pubsub,
    getProvider,
    providerNames,
    derivedValues
  } = init;
  const traceId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = createLogger(traceId);
  const cookies = createCookieJar(request);

  const base: Record<string, unknown> = {
    request,
    headers: request.headers,
    method: request.method,
    url,
    route,
    params,
    query,
    body,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1',
    log,
    cookies,
    cache,
    session,
    queue,
    pubsub,
    json: (status: number, data: unknown) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      }),
    error: (status: number, message?: string) =>
      new Response(JSON.stringify({ error: message ?? 'Error' }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      }),
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { Location: location } })
  };

  const ctx: any = new Proxy(base, {
    get(target, key) {
      const k = key as string;
      if (k in target) return target[k];
      if (k in derivedValues) return derivedValues[k];
      if (providerNames.has(k)) return getProvider(k, ctx);
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
    has(target, key) {
      return (
        key in target ||
        key in derivedValues ||
        providerNames.has(key as string)
      );
    }
  });

  return ctx as BaseCtx;
};
