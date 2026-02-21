import type { AnyMiddleware } from '../middleware';

export type SecureHeadersOpts = {
  frameOptions?: string | false;
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string | false;
  hsts?: string | false;
  permissionsPolicy?: string | false;
  coop?: string | false;
  csp?: string | false;
};

export const secureHeaders = (opts: SecureHeadersOpts = {}): AnyMiddleware => {
  const {
    frameOptions = 'SAMEORIGIN',
    contentTypeOptions = true,
    xssProtection = true,
    referrerPolicy = 'strict-origin-when-cross-origin',
    hsts = 'max-age=15552000; includeSubDomains',
    permissionsPolicy = 'camera=(), display-capture=(), fullscreen=*, geolocation=(), microphone=()',
    coop = 'same-origin',
    csp = false
  } = opts;

  const entries: [string, string][] = [];
  if (frameOptions) entries.push(['X-Frame-Options', frameOptions]);
  if (contentTypeOptions) entries.push(['X-Content-Type-Options', 'nosniff']);
  if (xssProtection) entries.push(['X-XSS-Protection', '0']);
  if (referrerPolicy) entries.push(['Referrer-Policy', referrerPolicy]);
  if (hsts) entries.push(['Strict-Transport-Security', hsts]);
  if (permissionsPolicy)
    entries.push(['Permissions-Policy', permissionsPolicy]);
  if (coop) entries.push(['Cross-Origin-Opener-Policy', coop]);
  if (csp) entries.push(['Content-Security-Policy', csp]);

  return async (_ctx, next) => {
    const res = await next();
    const headers = new Headers(res.headers);
    for (const [k, v] of entries) headers.set(k, v);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  };
};
