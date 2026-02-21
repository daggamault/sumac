import type { AnyMiddleware } from '../middleware';

export const timeout =
  (ms: number): AnyMiddleware =>
  async (ctx, next) => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const race = Promise.race([
      next(),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('Request timeout')), ms);
      })
    ]);

    try {
      return await race;
    } catch (err) {
      if (err instanceof Error && err.message === 'Request timeout') {
        return ctx.error(408, 'Request timeout');
      }
      throw err;
    } finally {
      clearTimeout(timerId);
    }
  };
