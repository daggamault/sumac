import type { SessionAdapter } from '../types';
import { createMemoryCache } from './cache';

export const createMemorySession = (): SessionAdapter => {
  const cache = createMemoryCache();
  return {
    get: (sid) => cache.get(`sess:${sid}`),
    set: (sid, data, opts) => cache.set(`sess:${sid}`, data, opts),
    delete: (sid) => cache.delete(`sess:${sid}`)
  };
};
