import { count } from 'drizzle-orm';
import { comments, posts, users } from '@/shared/data-access/schema';
import type { AuthCtx } from '@/shared/util/context';

export const stats = ({ db }: AuthCtx) => ({
  users: db.select({ count: count() }).from(users).get()!.count,
  posts: db.select({ count: count() }).from(posts).get()!.count,
  comments: db.select({ count: count() }).from(comments).get()!.count
});
