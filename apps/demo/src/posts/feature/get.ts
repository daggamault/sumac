import { HttpError } from '@daggamault/sumac';
import { findPost } from '@/posts/data-access/find-post';
import type { Post } from '@/shared/util';
import type { AppCtx } from '@/shared/util/context';

export const get = async ({ cache, db, params: { id } }: AppCtx) => {
  const cached = await cache.get<Post>(`post:${id}`);
  if (cached) return cached;
  const post = findPost(db, id);
  if (!post) throw new HttpError(404, 'Post not found');
  await cache.set(`post:${id}`, post, { ttl: '5m' });
  return post;
};
