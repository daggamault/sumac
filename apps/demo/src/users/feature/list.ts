import type { AuthCtx } from '@/shared/util/context';
import { listUsers } from '@/users/data-access/list-users';

export const list = ({ db }: AuthCtx) => listUsers(db);
