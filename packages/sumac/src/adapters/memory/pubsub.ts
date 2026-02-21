import type { PubSubAdapter } from '../types';

export const createMemoryPubSub = (): PubSubAdapter => {
  const listeners = new Map<
    string,
    ((payload: unknown) => void | Promise<void>)[]
  >();

  return {
    async publish(event, payload) {
      const handlers = listeners.get(event) ?? [];
      await Promise.allSettled(
        handlers.map((h) => Promise.resolve(h(payload)))
      );
    },
    subscribe(event, handler) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }
  };
};
