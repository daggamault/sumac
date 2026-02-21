import type { AppCtx } from '@/shared/util/context';

export const notify = async (
  { log }: AppCtx,
  payload: { postId: string; title: string; authorId: string }
) => {
  log.info({ message: 'Notification dispatched', ...payload });
};
