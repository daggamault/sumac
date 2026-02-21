import type { Middleware } from '@daggamaultz/sumac';
import type { SafeUser } from '.';
import type { AppCtx } from './context';

export const SESSION_COOKIE = 'session';

export const authenticated =
  (): Middleware<AppCtx, { user: SafeUser }> =>
  async ({ user, error }, next) => {
    if (!user) return error(401, 'Authentication required');
    return next({ user });
  };

export const adminOnly =
  (): Middleware<AppCtx & { user: SafeUser }> =>
  async ({ user, error }, next) => {
    if (user.role !== 'admin') return error(403, 'Admin access required');
    return next();
  };
