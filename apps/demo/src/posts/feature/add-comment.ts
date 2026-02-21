import { HttpError, type Static } from '@daggamaultz/sumac';
import { findPost } from '@/posts/data-access/find-post';
import { insertComment } from '@/posts/data-access/insert-comment';
import type { AuthCtx } from '@/shared/util/context';
import type { CreateComment } from '@/shared/util/schemas';

type Ctx = AuthCtx & { body: Static<typeof CreateComment> };

export const addComment = async ({
  db,
  params: { id },
  body: { text },
  user,
  json
}: Ctx) => {
  if (!findPost(db, id)) throw new HttpError(404, 'Post not found');
  const comment = insertComment(db, {
    id: crypto.randomUUID(),
    postId: id,
    text,
    authorId: user.id,
    createdAt: new Date().toISOString()
  });
  return json(201, comment);
};
