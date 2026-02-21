import { HttpError } from '@daggamaultz/sumac';
import type { AuthCtx } from '@/shared/util/context';
import { deletePost } from '@/posts/data-access/delete-post';
import { findPost } from '@/posts/data-access/find-post';

export const remove = async ({
  db,
  params: { id },
  user,
  cache,
  pubsub
}: AuthCtx) => {
  const post = findPost(db, id);
  if (!post) throw new HttpError(404, 'Post not found');
  if (post.authorId !== user.id)
    throw new HttpError(403, 'You do not own this post');
  deletePost(db, id);
  await Promise.all([cache.delete(`post:${id}`), cache.delete('posts:list')]);
  await pubsub.publish('post.deleted', {
    id: post.id,
    authorId: post.authorId
  });
  return { deleted: true };
};
