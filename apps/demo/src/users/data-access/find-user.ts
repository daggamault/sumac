import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { users as usersTable } from '@/shared/data-access/schema';
import type { SafeUser } from '@/shared/util';

const safeColumns = {
  id: usersTable.id,
  name: usersTable.name,
  role: usersTable.role
};

export const findUser = (db: Db, id: string): SafeUser | null =>
  db.select(safeColumns).from(usersTable).where(eq(usersTable.id, id)).get() ??
  null;
