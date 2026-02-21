export type Middleware<
  Ctx = any,
  Resolve extends Record<string, unknown> = Record<never, never>
> = (
  ctx: Ctx,
  next: (resolve?: Resolve) => Promise<Response>
) => Promise<Response>;

export type AnyMiddleware = Middleware<any, any>;
export type AnyHandler = (ctx: any) => unknown | Promise<unknown>;

export const toResponse = (result: unknown, cookies: string[]): Response => {
  let res: Response;
  if (result instanceof Response) {
    res = result;
  } else if (result === undefined || result === null) {
    res = new Response(null, { status: 204 });
  } else {
    res = new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!cookies.length) return res;
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
};

export const compileChain = (
  middlewares: AnyMiddleware[],
  handler: AnyHandler
): ((ctx: any) => Promise<Response>) => {
  const execute = async (ctx: any): Promise<Response> =>
    toResponse(await handler(ctx), ctx.cookies?._setCookies ?? []);

  if (!middlewares.length) return execute;

  return middlewares.reduceRight(
    (next: (ctx: any) => Promise<Response>, mw: AnyMiddleware) => (ctx: any) =>
      mw(ctx, async (resolve) => {
        const refined = resolve
          ? Object.assign(Object.create(ctx), resolve)
          : ctx;
        return next(refined);
      }),
    execute
  );
};
