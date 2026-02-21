import type { AnyMiddleware } from '../middleware';

export const rateLimit =
  (max = 100, window = '1m'): AnyMiddleware =>
  async (ctx, next) => {
    const key = `rl:${ctx.ip}:${ctx.route}`;
    const hits = await ctx.cache.incr(key, { ttl: window });
    if (hits > max) return ctx.error(429, 'Rate limit exceeded');
    return next();
  };
