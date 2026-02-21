import type { Db } from '@/shared/data-access';
import { comments as commentsTable } from '@/shared/data-access/schema';

export const insertComment = (
  db: Db,
  data: typeof commentsTable.$inferInsert
) => db.insert(commentsTable).values(data).returning().get()!;
