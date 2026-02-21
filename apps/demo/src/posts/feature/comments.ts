import { HttpError } from '@daggamault/sumac';
import { findPost } from '@/posts/data-access/find-post';
import { listComments } from '@/posts/data-access/list-comments';
import type { AppCtx } from '@/shared/util/context';

export const comments = ({ db, params: { id } }: AppCtx) => {
  if (!findPost(db, id)) throw new HttpError(404, 'Post not found');
  return listComments(db, id);
};
