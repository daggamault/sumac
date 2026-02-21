import type { Sumac } from '../sumac';

type RequestOpts = {
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
};

type ClientProxy = {
  [key: string]: ClientProxy & {
    get(opts?: RequestOpts): Promise<unknown>;
    post(opts?: RequestOpts): Promise<unknown>;
    put(opts?: RequestOpts): Promise<unknown>;
    patch(opts?: RequestOpts): Promise<unknown>;
    delete(opts?: RequestOpts): Promise<unknown>;
  };
};

type ClientOpts = {
  baseUrl: string;
  headers?: Record<string, string>;
};

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const buildUrl = (
  base: string,
  path: string,
  query?: Record<string, string | number | boolean>
) => {
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query))
      url.searchParams.set(k, String(v));
  }
  return url.toString();
};

const makeRequest = async (
  baseUrl: string,
  path: string,
  method: string,
  opts: RequestOpts = {},
  globalHeaders: Record<string, string> = {}
) => {
  const url = buildUrl(baseUrl, `/${path}`, opts.query);
  const headers: Record<string, string> = { ...globalHeaders, ...opts.headers };
  const init: RequestInit = { method: method.toUpperCase(), headers };

  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    (init.headers as Record<string, string>)['Content-Type'] =
      'application/json';
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(
      new Error((err as { error?: string }).error ?? res.statusText),
      { status: res.status, body: err }
    );
  }

  if (res.status === 204) return null;
  return res.json();
};

const createProxy = (segments: string[], opts: ClientOpts): ClientProxy =>
  new Proxy({} as ClientProxy, {
    get(_, key) {
      const k = key as string;
      if (k === 'then' || k === 'catch' || k === 'finally') return undefined;

      if (METHODS.has(k)) {
        return (reqOpts?: RequestOpts) =>
          makeRequest(
            opts.baseUrl,
            segments.join('/'),
            k,
            reqOpts,
            opts.headers
          );
      }

      return createProxy([...segments, k], opts);
    }
  });

export const createClient = <_App extends Sumac<never>>(
  opts: ClientOpts
): ClientProxy => createProxy([], opts);
