import type { AuthCtx } from '@/shared/util/context';

export const me = ({ user }: AuthCtx) => user;
