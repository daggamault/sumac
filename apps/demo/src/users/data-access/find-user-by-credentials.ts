import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { users as usersTable } from '@/shared/data-access/schema';
import type { SafeUser } from '@/shared/util';

export const findUserByCredentials = (
  db: Db,
  name: string,
  password: string
): SafeUser | null => {
  const user = db
    .select()
    .from(usersTable)
    .where(eq(usersTable.name, name))
    .get();
  if (!user || user.password !== password) return null;
  const { password: _, ...safe } = user;
  return safe;
};
