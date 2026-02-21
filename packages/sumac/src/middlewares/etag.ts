import type { AnyMiddleware } from '../middleware';

const hash = (str: string): string => {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export const etag = (): AnyMiddleware => async (ctx, next) => {
  if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next();

  const res = await next();
  if (res.status !== 200) return res;

  const body = await res.text();
  const tag = `W/"${hash(body)}"`;
  const ifNoneMatch = ctx.headers.get('if-none-match');

  if (ifNoneMatch === tag) {
    return new Response(null, { status: 304, headers: { ETag: tag } });
  }

  const headers = new Headers(res.headers);
  headers.set('ETag', tag);
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
};
