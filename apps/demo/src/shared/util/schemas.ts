import { t } from '@daggamault/sumac';

export const LoginCredentials = t.Object({
  name: t.String({ minLength: 1 }),
  password: t.String({ minLength: 1 })
});

export const CreatePost = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
  content: t.String({ minLength: 1 }),
  tags: t.Optional(t.Array(t.String()))
});

export const PatchPost = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  content: t.Optional(t.String({ minLength: 1 }))
});

export const CreateComment = t.Object({
  text: t.String({ minLength: 1, maxLength: 500 })
});
