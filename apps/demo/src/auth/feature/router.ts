import { type Module, Router } from 'sumac';
import type { AppCtx } from '@/shared/util/context';
import { LoginCredentials } from '@/shared/util/schemas';
import { login } from './login';
import { logout } from './logout';

export const authModule: Module = {
  route: '/auth',
  routers: [
    new Router<AppCtx>()
      .post('/login', { body: LoginCredentials }, login)
      .post('/logout', logout)
  ]
};
