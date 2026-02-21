# Sumac

TypeScript web framework for Node and Bun. Built on web-standard `Request`/`Response`. One schema gives you validation, TypeScript types, and OpenAPI docs. Middleware narrows `ctx` types through `next()` — the compiler enforces what middleware guarantees.

## Install

```bash
bun add sumac
# or
npm install sumac
```

## Quick start

**Bun**

```typescript
import { serve } from 'bun';
import { Router, Sumac, type Module } from 'sumac';
import { bunHandler } from 'sumac/runtime/bun';
import { cors, secureHeaders, timing } from 'sumac';

const systemModule: Module = {
  route: '/',
  routers: [new Router().get('/health', () => ({ ok: true }))],
};

const app = new Sumac()
  .use(timing(), cors(), secureHeaders())
  .modules(systemModule);

serve({ port: 3000, fetch: bunHandler(app) });
```

**Node**

```typescript
import { createServer } from 'node:http';
import { Router, Sumac, type Module } from 'sumac';
import { nodeHandler } from 'sumac/runtime/node';
import { cors, secureHeaders, timing } from 'sumac';

const systemModule: Module = {
  route: '/',
  routers: [new Router().get('/health', () => ({ ok: true }))],
};

const app = new Sumac()
  .use(timing(), cors(), secureHeaders())
  .modules(systemModule);

createServer(nodeHandler(app)).listen(3000);
```

---

## App setup

### Environment

`.env` files are loaded automatically. Variables already set in `process.env` are not overwritten.

### Adapters

All adapters default to in-memory. Pass a custom implementation directly — no wrapper needed.

```typescript
const app = new Sumac({
  cache: 'memory',    // default
  session: 'memory',
  queue: 'memory',
  pubsub: 'memory',
});

// Custom adapter:
const app = new Sumac({
  cache: myRedisCache,
  session: myRedisSession,
});
```

### Providers

Register services once. They're lazy — only instantiated when first accessed on `ctx`. Disposed in reverse order on shutdown.

```typescript
const app = new Sumac()
  .provide('db', () => drizzle(new Database(process.env.DATABASE_PATH)), {
    dispose: db => db.$client.close(),
  })
  .provide('stripe', () => new Stripe(process.env.STRIPE_KEY))
  .provide('auth', ctx => new AuthService(ctx.db, process.env.JWT_SECRET));
  //                                       ^^^^^^ providers can reference each other
```

### Derive

Compute per-request values once. Result merges into `ctx` with full type inference.

```typescript
const app = new Sumac()
  .provide('db', createDb)
  .derive(async ({ cookies, session, db }) => {
    const sid = cookies.get(SESSION_COOKIE);
    if (!sid) return { user: null };
    const data = await session.get<{ userId: string }>(sid);
    return { user: data ? findUser(db, data.userId) : null };
  });

// ctx.user is now User | null on every handler
```

---

## Schemas

One declaration produces runtime validation + a TypeScript type. Pass a schema to a route and `ctx.body`, `ctx.query`, `ctx.params` are typed automatically.

```typescript
import { t } from 'sumac';

const CreatePost = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
  body: t.String({ minLength: 1 }),
  tags: t.Optional(t.Array(t.String())),
});

const Pagination = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

// Available types:
t.String(opts?)           // { format?, minLength?, maxLength?, pattern? }
t.Number(opts?)           // { minimum?, maximum? }
t.Integer(opts?)          // { minimum?, maximum? }
t.Boolean()
t.Null()
t.Literal(value)          // exact string | number | boolean
t.Optional(schema)        // makes a field optional (undefined)
t.Nullable(schema)        // allows null
t.Any()                   // unknown — skips validation
t.Union([...schemas])     // any of
t.Enum(['a', 'b'])        // string union
t.Object({ ... })         // object with typed fields
t.Array(schema, opts?)    // { minItems?, maxItems? }
```

---

## Routing

All routes are defined on a `Router`. Routers are mounted via `app.modules()` as part of a module.

```typescript
import { Router } from 'sumac';

const posts = new Router()
  .get('/', { query: Pagination }, async ({ db, query }) => {
    return listPosts(db, query);
  })
  .post('/', { body: CreatePost }, async ({ db, body, json }) => {
    const post = insertPost(db, body);
    return json(201, post);
  })
  .get('/:id', async ({ db, params: { id } }) => {
    const post = findPost(db, id);
    if (!post) throw new HttpError(404, 'Not found');
    return post;
  })
  .get('/files/*', async ({ params }) => {
    // params[0] captures everything after /files/
  });
```

**Route options:**

```typescript
{
  body?: Schema,                     // validates + types ctx.body
  query?: Schema,                    // validates + types ctx.query
  params?: Schema,                   // validates + types ctx.params
  headers?: Schema,                  // validates request headers
  response?: Record<number, Schema>, // for OpenAPI docs
  use?: Middleware[],                // route-level middleware
}
```

**Return conventions:**

```typescript
return data                  // 200 + JSON
return json(201, data)       // custom status + JSON
return error(422, 'msg')     // error response
return redirect('/login')    // 302 redirect
return new Response(...)     // raw response
// return nothing/undefined → 204 No Content
```

---

## Middleware

Middleware runs before (and optionally after) your handler. Return early to short-circuit. Call `next()` to continue.

```typescript
import type { AnyMiddleware } from 'sumac';

// Before/after wrapper
const timing: AnyMiddleware = async (_ctx, next) => {
  const start = performance.now();
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('X-Duration', `${(performance.now() - start).toFixed(2)}ms`);
  return new Response(res.body, { status: res.status, headers });
};

// Guard — short-circuit if condition fails
const requireApiKey: AnyMiddleware = async ({ headers, error }, next) => {
  if (headers.get('x-api-key') !== process.env.API_KEY)
    return error(401, 'Invalid API key');
  return next();
};

// Parameterized middleware (always use factory function call syntax)
const requireRole = (role: string): AnyMiddleware => async ({ user, error }, next) => {
  if (user?.role !== role) return error(403, 'Forbidden');
  return next();
};
```

### Type-narrowing middleware

Pass a value into `next()` to narrow `ctx` types for everything downstream. The compiler enforces it.

```typescript
import type { Middleware } from 'sumac';

type AppCtx = BaseCtx & { user: User | null };
type User = { id: string; role: string };

// After this middleware, ctx.user is User (not User | null)
const authenticated = (): Middleware<AppCtx, { user: User }> => async ({ user, error }, next) => {
  if (!user) return error(401, 'Not authenticated');
  return next({ user }); // narrows User | null → User
};

const adminOnly = (): Middleware<AppCtx & { user: User }> => async ({ user, error }, next) => {
  if (user.role !== 'admin') return error(403, 'Forbidden');
  return next();
};

// Apply to a router — ctx.user is User in all handlers below
const adminRouter = new Router<AppCtx>()
  .use(authenticated())
  .use(adminOnly())
  .get('/stats', ({ db }) => getStats(db));
```

### Using middleware

```typescript
// Global — applies to all routes
app.use(cors(), secureHeaders(), timing());

// Router-scoped — applies to all routes in this router
const api = new Router().use(authenticated());

// Route-level — applies to one route only
router.post('/upload', { use: [bodyLimit('10mb')] }, handler);
```

### Built-in middleware

| Import | Signature | Description |
|--------|-----------|-------------|
| `cors` | `cors(opts?)` | CORS headers + preflight |
| `secureHeaders` | `secureHeaders(opts?)` | Security headers (CSP, HSTS, etc.) |
| `timing` | `timing()` | `X-Response-Time` header |
| `requestId` | `requestId(opts?)` | `X-Request-Id` header, injects `ctx.requestId` |
| `logger` | `logger()` | Structured JSON request logs |
| `rateLimit` | `rateLimit(max?, window?)` | IP + route rate limiting via cache |
| `bodyLimit` | `bodyLimit(limit?)` | Reject oversized request bodies |
| `timeout` | `timeout(ms)` | 408 if handler takes too long |
| `compress` | `compress()` | gzip/deflate response compression |
| `etag` | `etag()` | ETag + 304 Not Modified |
| `noCache` | `noCache()` | `Cache-Control: no-store` |

**`cors` options:**

```typescript
cors({
  origin: '*',                                 // default — allow all
  origin: 'https://myapp.com',                 // single origin
  origin: ['https://a.com', 'https://b.com'],  // list
  origin: o => o.endsWith('.myapp.com'),        // function
  methods: ['GET', 'POST'],                    // default — all common methods
  headers: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
})
```

**`secureHeaders` options** (all on by default, pass `false` to disable):

```typescript
secureHeaders({
  frameOptions: 'SAMEORIGIN',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  hsts: 'max-age=15552000; includeSubDomains',
  permissionsPolicy: 'camera=(), microphone=()',
  coop: 'same-origin',
  csp: "default-src 'self'",   // false by default
})
```

**`rateLimit`** uses `ctx.cache` — works with any cache adapter:

```typescript
app.use(rateLimit())           // default: 100 req/min per IP per route
app.use(rateLimit(50, '30s'))  // custom limit + window
```

**`bodyLimit`** accepts bytes or strings:

```typescript
app.use(bodyLimit())        // default: 1mb
app.use(bodyLimit('512kb')) // or '2gb', 1048576
```

---

## Context

Every handler and middleware receives `ctx`:

```typescript
ctx.request     // raw Request
ctx.headers     // Headers
ctx.method      // 'GET' | 'POST' | ...
ctx.url         // URL
ctx.route       // matched pattern, e.g. '/users/:id'
ctx.params      // { id: string } (typed if params schema given)
ctx.query       // { page: string } (typed if query schema given)
ctx.body        // unknown (typed if body schema given)
ctx.ip          // client IP (reads x-forwarded-for)
ctx.log         // structured logger { info, error, warn, debug }
ctx.cookies     // { get, set, delete }

// Built-in adapters
ctx.cache       // CacheAdapter
ctx.session     // SessionAdapter
ctx.queue       // QueueAdapter
ctx.pubsub      // PubSubAdapter

// Response helpers
ctx.json(status, data)     // JSON response with status code
ctx.error(status, message) // error response
ctx.redirect(url, status?) // redirect (default 302)
```

**Cache:**

```typescript
await ctx.cache.set('key', value, { ttl: '5m' })
await ctx.cache.get<MyType>('key')               // MyType | null
await ctx.cache.delete('key')
await ctx.cache.has('key')                       // boolean
await ctx.cache.incr('rate:key', { ttl: '1m' }) // number
```

**Session:**

```typescript
await ctx.session.set(sid, { userId: '123' }, { ttl: '7d' })
await ctx.session.get<{ userId: string }>(sid)  // { userId: string } | null
await ctx.session.delete(sid)
```

**Queue:**

```typescript
await ctx.queue.enqueue('email.welcome', { to: user.email, name: user.name })
```

**PubSub:**

```typescript
await ctx.pubsub.publish('order.created', { orderId: '123' })
```

**Cookies:**

```typescript
ctx.cookies.get('session')
ctx.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 604800 })
ctx.cookies.delete('session')
```

**Logger:**

```typescript
ctx.log.info({ userId: ctx.user?.id, action: 'login' })
ctx.log.error({ message: 'db timeout', route: ctx.route })
ctx.log.warn('slow query detected')
ctx.log.debug({ query, params })
```

---

## Modules

A module co-locates routes, background jobs, and event handlers under a common prefix. Pass modules to `app.modules()`.

```typescript
import { type Module } from 'sumac';

export const postsModule: Module = {
  route: '/posts',
  routers: [publicPostsRouter, authPostsRouter],
  jobs: {
    'post.notify': {
      payload: t.Object({ postId: t.String(), title: t.String() }),
      retries: 3,
      backoff: 'exponential',
      handler: async (ctx, payload) => {
        ctx.log.info({ message: 'Notification dispatched', ...payload });
      },
    },
  },
  events: {
    'post.created': async (ctx, payload) => {
      await ctx.queue.enqueue('post.notify', { postId: payload.id, title: payload.title });
    },
  },
};

app.modules(systemModule, authModule, postsModule, usersModule);
```

Multiple routers per module (e.g. public + authenticated):

```typescript
export const postsModule: Module = {
  route: '/posts',
  routers: [publicPostsRouter, authPostsRouter],
};
```

---

## Error handling

```typescript
import { HttpError } from 'sumac';

// Global catch-all
app.catch(async (ctx, err) => {
  ctx.log.error({ message: err.message, route: ctx.route });
  if (err instanceof HttpError) return ctx.error(err.status, err.message);
  return ctx.error(500, 'Internal server error');
});

// Throw from any handler or middleware:
throw new HttpError(404, 'User not found');
throw new HttpError(422, 'Validation failed', issues);
```

---

## OpenAPI

```typescript
app.openApi('/docs'); // serves the OpenAPI JSON at /docs, no-op in production
```

Schemas passed to route `body`, `query`, `params`, `headers`, and `response` options are automatically included. The endpoint is automatically disabled when `NODE_ENV=production`.

---

## Client

A path-based proxy for making requests. Chain path segments and call the HTTP method.

```typescript
import { createClient } from 'sumac/client';

const api = createClient({ baseUrl: 'https://api.example.com' });

const posts = await api.posts.get({ query: { page: 1, limit: 10 } });
const post  = await api.posts[postId].get();
const next  = await api.posts.post({ body: { title: 'Hello', content: '...' } });

// Per-request headers
const me = await api.users.me.get({ headers: { authorization: `Bearer ${token}` } });
```

---

## Graceful shutdown

```typescript
import { createServer } from 'node:http';

const server = createServer(nodeHandler(app));
server.listen(3000);

const shutdown = async () => {
  server.close();
  await app.dispose(); // runs dispose functions in reverse registration order
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## Custom adapters

Implement the adapter interface and pass it to the `Sumac` constructor:

```typescript
import type { CacheAdapter } from 'sumac';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const redisCache: CacheAdapter = {
  async get<T>(key: string) {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  },
  async set(key, value, opts) {
    const ms = opts?.ttl ? parseTtl(opts.ttl) : undefined;
    await (ms
      ? redis.set(key, JSON.stringify(value), 'PX', ms)
      : redis.set(key, JSON.stringify(value)));
  },
  async delete(key) { await redis.del(key); },
  async has(key) { return (await redis.exists(key)) === 1; },
  async incr(key, opts) {
    const val = await redis.incr(key);
    if (opts?.ttl && val === 1) await redis.pexpire(key, parseTtl(opts.ttl));
    return val;
  },
};

const app = new Sumac({ cache: redisCache });
```
