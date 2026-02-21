import type { Static } from 'sumac';
import { SESSION_COOKIE } from '@/shared/util/auth';
import type { AppCtx } from '@/shared/util/context';
import type { LoginCredentials } from '@/shared/util/schemas';
import { findUserByCredentials } from '@/users/data-access/find-user-by-credentials';

type Ctx = AppCtx & { body: Static<typeof LoginCredentials> };

export const login = async ({
  body: { name, password },
  db,
  session,
  cookies,
  json,
  error
}: Ctx) => {
  const user = findUserByCredentials(db, name, password);
  if (!user) return error(401, 'Invalid credentials');
  const sid = crypto.randomUUID();
  await session.set(sid, { userId: user.id }, { ttl: '24h' });
  cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/'
  });
  return json(201, { user });
};
