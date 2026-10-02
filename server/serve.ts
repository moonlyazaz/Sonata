import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, match, type Ctx, type Result } from './routes';

/**
 * Adaptador Node → rotas.
 *
 * Uma só função atende os dois mundos: o middleware do Vite em dev e as
 * funções da Vercel em produção. Os dois entregam `IncomingMessage` +
 * `ServerResponse`, então escrever um terceiro adaptador seria código morto.
 *
 * Não dependo de `res.status().json()` (API só existe no runtime da Vercel) —
 * uso `statusCode` + `setHeader` + `end`, que são do `node:http`.
 */

/** 4 MB: o limite da Vercel para corpo de função é 4.5 MB. */
const MAX_BODY = 4 * 1024 * 1024;

type MaybeVercel = IncomingMessage & { body?: unknown };

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    if (k) out[k] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

function coerce(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readBody(req: MaybeVercel): Promise<unknown> {
  // Vercel já desserializou — e o stream já foi consumido
  if (req.body !== undefined) return coerce(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Corpo da requisição muito grande.');
    chunks.push(chunk);
  }
  return coerce(Buffer.concat(chunks).toString('utf8'));
}

function send(res: ServerResponse, status: number, json: unknown, setCookie?: string[]): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (setCookie?.length) res.setHeader('Set-Cookie', setCookie);
  res.end(JSON.stringify(json));
}

export async function serveApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://sonata.local');
    const handler = match(req.method ?? 'GET', url.pathname);

    if (!handler) {
      send(res, 404, { erro: `Rota não encontrada: ${req.method} ${url.pathname}` });
      return;
    }

    const proto = req.headers['x-forwarded-proto'];
    const ctx: Ctx = {
      method: (req.method ?? 'GET').toUpperCase(),
      pathname: url.pathname,
      query: url.searchParams,
      body: await readBody(req as MaybeVercel),
      cookies: parseCookies(req.headers.cookie),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      secure: proto === 'https' || process.env.VERCEL === '1',
    };

    const result: Result = await handler(ctx);
    send(res, result.status, result.json, result.setCookie);
  } catch (e) {
    if (e instanceof HttpError) {
      send(res, e.status, { erro: e.message });
      return;
    }
    console.error('[sonata/api] erro não tratado:', e);
    send(res, 500, { erro: 'Erro interno ao falar com o servidor.' });
  }
}
