import { type Module, Router } from 'sumac';
import { adminOnly, authenticated } from '@/shared/util/auth';
import type { AppCtx } from '@/shared/util/context';
import { list } from './list';
import { me } from './me';

export const usersModule: Module = {
  route: '/users',
  routers: [
    new Router<AppCtx>().use(authenticated()).get('/me', me),
    new Router<AppCtx>().use(authenticated()).use(adminOnly()).get('/', list)
  ]
};
