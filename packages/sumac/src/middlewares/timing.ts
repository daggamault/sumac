import type { AnyMiddleware } from '../middleware';

export const timing = (): AnyMiddleware => async (_ctx, next) => {
  const start = performance.now();
  const res = await next();
  const ms = (performance.now() - start).toFixed(2);
  const headers = new Headers(res.headers);
  headers.set('X-Response-Time', `${ms}ms`);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
};
