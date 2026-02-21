import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { posts as postsTable } from '@/shared/data-access/schema';

export const deletePost = (db: Db, id: string): void => {
  db.delete(postsTable).where(eq(postsTable.id, id)).run();
};
