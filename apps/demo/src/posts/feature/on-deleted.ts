import type { AppCtx } from '@/shared/util/context';

export const onDeleted = async (
  { log }: AppCtx,
  payload: { id: string; authorId: string }
) => {
  log.info({ message: 'Post deleted', ...payload });
};
