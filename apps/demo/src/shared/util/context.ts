import type { BaseCtx } from '@daggamault/sumac';
import type { Db } from '@/shared/data-access';
import type { SafeUser } from '.';

export type AppCtx = BaseCtx & { db: Db; user: SafeUser | null };
export type AuthCtx = AppCtx & { user: SafeUser };
