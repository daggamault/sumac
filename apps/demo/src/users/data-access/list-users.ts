import type { Db } from '@/shared/data-access';
import { users as usersTable } from '@/shared/data-access/schema';
import type { SafeUser } from '@/shared/util';

const safeColumns = {
  id: usersTable.id,
  name: usersTable.name,
  role: usersTable.role
};

export const listUsers = (db: Db): SafeUser[] =>
  db.select(safeColumns).from(usersTable).all();
