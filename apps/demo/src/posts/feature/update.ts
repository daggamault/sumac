import { HttpError, type Static } from '@daggamault/sumac';
import { findPost } from '@/posts/data-access/find-post';
import { updatePost } from '@/posts/data-access/update-post';
import type { AuthCtx } from '@/shared/util/context';
import type { PatchPost } from '@/shared/util/schemas';

type Ctx = AuthCtx & { body: Static<typeof PatchPost> };

export const update = async ({
  db,
  params: { id },
  user,
  body,
  cache
}: Ctx) => {
  const post = findPost(db, id);
  if (!post) throw new HttpError(404, 'Post not found');
  if (post.authorId !== user.id)
    throw new HttpError(403, 'You do not own this post');
  const updated = updatePost(db, id, body);
  await Promise.all([cache.delete(`post:${id}`), cache.delete('posts:list')]);
  return updated;
};
