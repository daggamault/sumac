import { type Module, Router } from 'sumac';
import type { AppCtx } from '@/shared/util/context';

export const systemModule: Module = {
  route: '/',
  routers: [
    new Router<AppCtx>()
      .get('/', () => ({ message: 'Welcome to the Sumac demo API!' }))
      .get('/health', () => ({ ok: true, timestamp: new Date().toISOString() }))
  ]
};
