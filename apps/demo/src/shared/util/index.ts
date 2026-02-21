import type { comments, posts, users } from '@/shared/data-access/schema';

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'password'>;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
