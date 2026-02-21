import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { posts as postsTable } from '@/shared/data-access/schema';
import type { Post } from '@/shared/util';

export const findPost = (db: Db, id: string): Post | null =>
  db.select().from(postsTable).where(eq(postsTable.id, id)).get() ?? null;
