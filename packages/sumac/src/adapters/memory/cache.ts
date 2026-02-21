import type { CacheAdapter } from '../types';

const parseTtlMs = (ttl: string): number => {
  const units: Record<string, number> = {
    ms: 1,
    s: 1e3,
    m: 6e4,
    h: 36e5,
    d: 864e5
  };
  const m = ttl.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!m)
    throw new Error(
      `Invalid TTL format: "${ttl}". Use e.g. "500ms", "30s", "5m", "2h", "1d"`
    );
  return parseFloat(m[1]) * units[m[2]];
};

type Entry = { value: unknown; expires?: number };

export const createMemoryCache = (): CacheAdapter => {
  const store = new Map<string, Entry>();

  const alive = (e: Entry) => e.expires === undefined || Date.now() < e.expires;

  return {
    async get<T>(key: string): Promise<T | null> {
      const e = store.get(key);
      if (!e) return null;
      if (!alive(e)) {
        store.delete(key);
        return null;
      }
      return e.value as T;
    },

    async set(key, value, opts) {
      const expires = opts?.ttl ? Date.now() + parseTtlMs(opts.ttl) : undefined;
      store.set(key, { value, expires });
    },

    async delete(key) {
      store.delete(key);
    },

    async has(key) {
      const e = store.get(key);
      if (!e) return false;
      if (!alive(e)) {
        store.delete(key);
        return false;
      }
      return true;
    },

    async incr(key, opts) {
      const e = store.get(key);
      if (e && alive(e)) {
        const next = (typeof e.value === 'number' ? e.value : 0) + 1;
        store.set(key, { value: next, expires: e.expires });
        return next;
      }
      const expires = opts?.ttl ? Date.now() + parseTtlMs(opts.ttl) : undefined;
      store.set(key, { value: 1, expires });
      return 1;
    }
  };
};
