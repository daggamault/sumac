import { SESSION_COOKIE } from '@/shared/util/auth';
import type { AppCtx } from '@/shared/util/context';

export const logout = async ({ cookies, session }: AppCtx) => {
  const sid = cookies.get(SESSION_COOKIE);
  if (sid) await session.delete(sid);
  cookies.delete(SESSION_COOKIE);
  return { ok: true };
};
