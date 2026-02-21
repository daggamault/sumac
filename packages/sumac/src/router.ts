import type { BaseCtx } from './context';
import type { AnyHandler, AnyMiddleware, Middleware } from './middleware';
import type { AnySchema, Static } from './schema';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteOpts = {
  use?: AnyMiddleware[];
  body?: AnySchema;
  query?: AnySchema;
  params?: AnySchema;
  headers?: AnySchema;
  response?: Record<number, AnySchema>;
};

type WithBody<O extends RouteOpts> = O['body'] extends AnySchema
  ? { body: Static<O['body']> }
  : {};

type WithQuery<O extends RouteOpts> = O['query'] extends AnySchema
  ? { query: Static<O['query']> }
  : {};

type WithParams<O extends RouteOpts> = O['params'] extends AnySchema
  ? { params: Static<O['params']> }
  : {};

export type RouteCtx<Ctx, O extends RouteOpts> = Ctx &
  WithBody<O> &
  WithQuery<O> &
  WithParams<O>;

export type RouteEntry = {
  method: HttpMethod;
  pattern: string;
  regex: RegExp;
  keys: string[];
  opts: RouteOpts;
  handler: AnyHandler;
  routerMiddleware: AnyMiddleware[];
};

export const compilePattern = (
  pattern: string
): { regex: RegExp; keys: string[] } => {
  const keys: string[] = [];
  const normalized =
    pattern.length > 1 && pattern.endsWith('/')
      ? pattern.slice(0, -1)
      : pattern;
  const source = normalized
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${source}(?:/)?$`), keys };
};

export class Router<Ctx = BaseCtx> {
  private readonly _middleware: AnyMiddleware[] = [];
  readonly _routes: RouteEntry[] = [];
  _catchHandler?: (ctx: any, err: Error) => Promise<Response | undefined>;

  catch(
    handler: (ctx: Ctx, err: Error) => Promise<Response | undefined>
  ): this {
    this._catchHandler = handler as any;
    return this;
  }

  use<R extends Record<string, unknown>>(
    ...middlewares: Middleware<Ctx, R>[]
  ): Router<Ctx & R> {
    for (const mw of middlewares) this._middleware.push(mw as AnyMiddleware);
    return this as any;
  }

  private addRoute(
    method: HttpMethod,
    pattern: string,
    optsOrHandler: RouteOpts | AnyHandler,
    handler?: AnyHandler
  ): this {
    const opts: RouteOpts = handler ? (optsOrHandler as RouteOpts) : {};
    const h = (handler ?? optsOrHandler) as AnyHandler;
    const { regex, keys } = compilePattern(pattern);
    this._routes.push({
      method,
      pattern,
      regex,
      keys,
      opts,
      handler: h,
      routerMiddleware: [...this._middleware]
    });
    return this;
  }

  get<O extends RouteOpts>(
    pattern: string,
    opts: O,
    handler: (ctx: RouteCtx<Ctx, O>) => unknown
  ): this;
  get(pattern: string, handler: (ctx: Ctx) => unknown): this;
  get<O extends RouteOpts>(
    p: string,
    a: O | ((ctx: Ctx) => unknown),
    b?: (ctx: RouteCtx<Ctx, O>) => unknown
  ) {
    return this.addRoute('GET', p, a as any, b as any);
  }

  post<O extends RouteOpts>(
    pattern: string,
    opts: O,
    handler: (ctx: RouteCtx<Ctx, O>) => unknown
  ): this;
  post(pattern: string, handler: (ctx: Ctx) => unknown): this;
  post<O extends RouteOpts>(
    p: string,
    a: O | ((ctx: Ctx) => unknown),
    b?: (ctx: RouteCtx<Ctx, O>) => unknown
  ) {
    return this.addRoute('POST', p, a as any, b as any);
  }

  put<O extends RouteOpts>(
    pattern: string,
    opts: O,
    handler: (ctx: RouteCtx<Ctx, O>) => unknown
  ): this;
  put(pattern: string, handler: (ctx: Ctx) => unknown): this;
  put<O extends RouteOpts>(
    p: string,
    a: O | ((ctx: Ctx) => unknown),
    b?: (ctx: RouteCtx<Ctx, O>) => unknown
  ) {
    return this.addRoute('PUT', p, a as any, b as any);
  }

  patch<O extends RouteOpts>(
    pattern: string,
    opts: O,
    handler: (ctx: RouteCtx<Ctx, O>) => unknown
  ): this;
  patch(pattern: string, handler: (ctx: Ctx) => unknown): this;
  patch<O extends RouteOpts>(
    p: string,
    a: O | ((ctx: Ctx) => unknown),
    b?: (ctx: RouteCtx<Ctx, O>) => unknown
  ) {
    return this.addRoute('PATCH', p, a as any, b as any);
  }

  delete<O extends RouteOpts>(
    pattern: string,
    opts: O,
    handler: (ctx: RouteCtx<Ctx, O>) => unknown
  ): this;
  delete(pattern: string, handler: (ctx: Ctx) => unknown): this;
  delete<O extends RouteOpts>(
    p: string,
    a: O | ((ctx: Ctx) => unknown),
    b?: (ctx: RouteCtx<Ctx, O>) => unknown
  ) {
    return this.addRoute('DELETE', p, a as any, b as any);
  }
}
