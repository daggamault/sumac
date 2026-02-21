import type { Post } from '@/shared/util';
import type { AppCtx } from '@/shared/util/context';

export const onCreated = async ({ queue }: AppCtx, payload: Post) => {
  await queue.enqueue('post.notify', {
    postId: payload.id,
    title: payload.title,
    authorId: payload.authorId
  });
};
