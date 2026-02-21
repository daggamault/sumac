import type { Static } from '@daggamault/sumac';
import { insertPost } from '@/posts/data-access/insert-post';
import type { AuthCtx } from '@/shared/util/context';
import type { CreatePost } from '@/shared/util/schemas';

type Ctx = AuthCtx & { body: Static<typeof CreatePost> };

export const create = async ({
  body: { title, content, tags },
  db,
  user,
  pubsub,
  json,
  cache
}: Ctx) => {
  const now = new Date().toISOString();
  const post = insertPost(db, {
    id: crypto.randomUUID(),
    title,
    content,
    tags: tags ?? [],
    authorId: user.id,
    createdAt: now,
    updatedAt: now
  });
  await cache.delete('posts:list');
  await pubsub.publish('post.created', post);
  return json(201, post);
};
