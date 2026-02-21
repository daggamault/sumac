import { listPosts } from '@/posts/data-access/list-posts';
import type { Post } from '@/shared/util';
import type { AppCtx } from '@/shared/util/context';
import { paginate } from '@/shared/util/paginate';
import { qp } from '@/shared/util/query';

export const list = async ({ query, db, cache }: AppCtx) => {
  const page = qp(query, 'page', 1);
  const limit = Math.min(qp(query, 'limit', 20), 50);
  const cached = await cache.get<Post[]>('posts:list');
  const posts = cached ?? listPosts(db);
  if (!cached) await cache.set('posts:list', posts, { ttl: '1m' });
  return paginate(posts, page, limit);
};
