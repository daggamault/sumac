import type { AnyMiddleware } from '../middleware';

export type RequestIdOpts = {
  header?: string;
  generate?: () => string;
};

export const requestId = (opts: RequestIdOpts = {}): AnyMiddleware => {
  const header = opts.header ?? 'X-Request-Id';
  const generate = opts.generate ?? (() => crypto.randomUUID());

  return async (ctx, next) => {
    const id = ctx.headers.get(header) ?? generate();
    const res = await next({ requestId: id });
    const headers = new Headers(res.headers);
    headers.set(header, id);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  };
};
