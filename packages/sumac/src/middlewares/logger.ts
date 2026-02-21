import type { AnyMiddleware } from '../middleware';

export const logger = (): AnyMiddleware => async (ctx, next) => {
  const start = performance.now();
  const res = await next();
  ctx.log.info({
    method: ctx.method,
    path: ctx.url.pathname,
    status: res.status,
    ms: parseFloat((performance.now() - start).toFixed(2))
  });
  return res;
};
