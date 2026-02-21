import { type Module, Router, t } from 'sumac';
import { authenticated } from '@/shared/util/auth';
import type { AppCtx } from '@/shared/util/context';
import { CreateComment, CreatePost, PatchPost } from '@/shared/util/schemas';
import { addComment } from './add-comment';
import { comments } from './comments';
import { create } from './create';
import { get } from './get';
import { list } from './list';
import { notify } from './notify';
import { onCreated } from './on-created';
import { onDeleted } from './on-deleted';
import { remove } from './remove';
import { update } from './update';

const publicPosts = new Router<AppCtx>()
  .get('/', list)
  .get('/:id', get)
  .get('/:id/comments', comments);

const authPosts = new Router<AppCtx>()
  .use(authenticated())
  .post('/', { body: CreatePost }, create)
  .patch('/:id', { body: PatchPost }, update)
  .delete('/:id', remove)
  .post('/:id/comments', { body: CreateComment }, addComment);

export const postsModule: Module = {
  route: '/posts',
  routers: [publicPosts, authPosts],
  jobs: {
    'post.notify': {
      payload: t.Object({
        postId: t.String(),
        title: t.String(),
        authorId: t.String()
      }),
      handler: notify
    }
  },
  events: {
    'post.created': onCreated,
    'post.deleted': onDeleted
  }
};
