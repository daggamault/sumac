import type { AnyMiddleware } from '../middleware';

export const compress = (): AnyMiddleware => async (ctx, next) => {
  const res = await next();
  if (res.headers.get('content-encoding') || !res.body) return res;

  const accept = ctx.headers.get('accept-encoding') ?? '';
  const encoding: CompressionFormat | null = accept.includes('gzip')
    ? 'gzip'
    : accept.includes('deflate')
      ? 'deflate'
      : null;

  if (!encoding) return res;

  const compressed = res.body.pipeThrough(new CompressionStream(encoding));
  const headers = new Headers(res.headers);
  headers.set('Content-Encoding', encoding);
  headers.delete('Content-Length');
  return new Response(compressed, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
};
