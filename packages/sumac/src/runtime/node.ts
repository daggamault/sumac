import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Sumac } from '../sumac';

export const nodeHandler =
  (app: Sumac<any>) => async (req: IncomingMessage, res: ServerResponse) => {
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const url = `${proto}://${req.headers.host ?? 'localhost'}${req.url}`;

    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: body.length > 0 ? new Uint8Array(body) : null
    });

    const response = await app.fetch(request);

    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    if (response.body) {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>)
        res.write(chunk);
    }
    res.end();
  };
