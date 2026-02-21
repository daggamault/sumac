import type { Db } from '@/shared/data-access';
import { posts as postsTable } from '@/shared/data-access/schema';
import type { Post } from '@/shared/util';

export const listPosts = (db: Db): Post[] => db.select().from(postsTable).all();
