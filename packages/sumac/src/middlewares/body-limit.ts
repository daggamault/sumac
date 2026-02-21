import type { AnyMiddleware } from '../middleware';

const parseBytes = (val: string | number): number => {
  if (typeof val === 'number') return val;
  const m = val.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!m) throw new Error(`Invalid size: "${val}"`);
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3
  };
  return Math.floor(parseFloat(m[1]) * (units[m[2] ?? 'b'] ?? 1));
};

export const bodyLimit = (limit: number | string = '1mb'): AnyMiddleware => {
  const max = parseBytes(limit);
  return async (ctx, next) => {
    const cl = ctx.headers.get('content-length');
    if (cl !== null && parseInt(cl, 10) > max)
      return ctx.error(413, 'Payload too large');
    return next();
  };
};
