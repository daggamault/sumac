import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { posts as postsTable } from '@/shared/data-access/schema';
import type { Post } from '@/shared/util';

export const updatePost = (
  db: Db,
  id: string,
  data: { title?: string; content?: string }
): Post =>
  db
    .update(postsTable)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(postsTable.id, id))
    .returning()
    .get()!;
