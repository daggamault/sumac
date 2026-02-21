import { serve } from 'bun';
import {
  bodyLimit,
  compress,
  cors,
  logger,
  rateLimit,
  requestId,
  Sumac,
  secureHeaders,
  timing
} from 'sumac';
import { bunHandler } from 'sumac/runtime/bun';
import { adminModule } from '@/admin/feature/router';
import { authModule } from '@/auth/feature/router';
import { postsModule } from '@/posts/feature/router';
import { createDb } from '@/shared/data-access';
import { SESSION_COOKIE } from '@/shared/util/auth';
import { systemModule } from '@/system/feature/router';
import { findUser } from '@/users/data-access/find-user';
import { usersModule } from '@/users/feature/router';

const app = new Sumac()
  .use(
    requestId(),
    logger(),
    timing(),
    compress(),
    secureHeaders(),
    cors(),
    bodyLimit(),
    rateLimit()
  )
  .provide('db', createDb)
  .derive(async ({ cookies, session, db }) => {
    const sid = cookies.get(SESSION_COOKIE);
    if (!sid) return { user: null };
    const data = await session.get<{ userId: string }>(sid);
    if (!data) return { user: null };
    return { user: findUser(db, data.userId) };
  })
  .modules(systemModule, authModule, postsModule, usersModule, adminModule)
  .openApi('/docs');

serve({ port: 3000, fetch: bunHandler(app) });

if (process.env.NODE_ENV !== 'production') {
  console.log('Server running at http://localhost:3000');
  console.log('OpenAPI docs at http://localhost:3000/docs');
}
