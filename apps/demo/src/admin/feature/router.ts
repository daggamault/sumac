import { type Module, Router } from '@daggamault/sumac';
import { adminOnly, authenticated } from '@/shared/util/auth';
import type { AppCtx } from '@/shared/util/context';
import { stats } from './stats';

export const adminModule: Module = {
  route: '/admin',
  routers: [
    new Router<AppCtx>()
      .use(authenticated())
      .use(adminOnly())
      .get('/stats', stats)
  ]
};
