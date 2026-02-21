import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/data-access';
import { comments as commentsTable } from '@/shared/data-access/schema';

export const listComments = (db: Db, postId: string) =>
  db.select().from(commentsTable).where(eq(commentsTable.postId, postId)).all();
