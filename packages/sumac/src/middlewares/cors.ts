import type { AnyMiddleware } from '../middleware';

export type CorsOpts = {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
};

const resolveOrigin = (
  requestOrigin: string,
  opt: CorsOpts['origin']
): string => {
  if (!opt || opt === '*') return '*';
  if (typeof opt === 'string') return opt;
  if (Array.isArray(opt))
    return opt.includes(requestOrigin) ? requestOrigin : '';
  return opt(requestOrigin) ? requestOrigin : '';
};

const buildCorsHeaders = (
  requestOrigin: string,
  opts: CorsOpts
): Record<string, string> => {
  const origin = resolveOrigin(requestOrigin, opts.origin);
  if (!origin) return {};

  const h: Record<string, string> = { 'Access-Control-Allow-Origin': origin };
  if (origin !== '*') h.Vary = 'Origin';
  if (opts.credentials) h['Access-Control-Allow-Credentials'] = 'true';
  const methods = opts.methods ?? [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS'
  ];
  h['Access-Control-Allow-Methods'] = methods.join(', ');
  const allowHeaders =
    opts.headers !== undefined
      ? opts.headers
      : ['Content-Type', 'Authorization'];
  if (allowHeaders.length)
    h['Access-Control-Allow-Headers'] = allowHeaders.join(', ');
  if (opts.maxAge !== undefined)
    h['Access-Control-Max-Age'] = String(opts.maxAge);
  return h;
};

export const cors =
  (opts: CorsOpts = {}): AnyMiddleware =>
  async (ctx, next) => {
    const origin = ctx.headers.get('origin') ?? '';
    const corsHeaders = buildCorsHeaders(origin, opts);

    if (ctx.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const res = await next();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  };
