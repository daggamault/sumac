import type { QueueAdapter } from '../types';

export const createMemoryQueue = (): QueueAdapter => {
  const handlers = new Map<string, (payload: unknown) => Promise<void>>();

  return {
    async enqueue(job, payload) {
      const handler = handlers.get(job);
      if (handler)
        queueMicrotask(() => {
          handler(payload).catch(console.error);
        });
    },
    process(job, handler) {
      handlers.set(job, handler);
    }
  };
};
