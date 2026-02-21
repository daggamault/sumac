import type { Db } from '@/shared/data-access';
import { posts as postsTable } from '@/shared/data-access/schema';
import type { Post } from '@/shared/util';

export const insertPost = (
  db: Db,
  data: typeof postsTable.$inferInsert
): Post => db.insert(postsTable).values(data).returning().get()!;
