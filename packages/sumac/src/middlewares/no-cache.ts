import type { AnyMiddleware } from '../middleware';

export const noCache = (): AnyMiddleware => async (_ctx, next) => {
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
};
