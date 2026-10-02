import type { ServerResponse } from 'node:http';

/**
 * Proxy do SoundCloud.
 *
 * Por que existe: o SoundCloud não manda `Access-Control-Allow-Origin`, então o
 * navegador nunca pode falar com ele direto. E por que não um rewrite externo
 * da Vercel? Porque ele repassa o `User-Agent` do visitante — com UA de celular
 * o SoundCloud responde 302 para `m.soundcloud.com`, o navegador segue
 * cross-origin e o CORS derruba o request.
 *
 * Aqui o UA é fixo (desktop) e qualquer redirect é seguido **no servidor**,
 * antes de chegar no navegador. É o mesmo código no dev (middleware do Vite) e
 * na Vercel (`api/sc.ts`).
 *
 * Alvo e caminho viajam na query string porque o `api/` da Vercel só aceita
 * dinâmico de **um** segmento — catch-all é recurso do Next.js.
 */

const ALVOS = {
  api: 'https://api-v2.soundcloud.com',
  web: 'https://soundcloud.com',
} as const;

export type Alvo = keyof typeof ALVOS;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** `/api/sc?alvo=api&u=/search/tracks&…` → `{ alvo, caminho }` */
export function parseSc(query: URLSearchParams): { alvo: Alvo; caminho: string } | null {
  const alvo = query.get('alvo');
  if (alvo !== 'api' && alvo !== 'web') return null;
  return { alvo, caminho: query.get('u') || '/' };
}

export async function proxySc(
  alvo: Alvo,
  caminho: string,
  query: URLSearchParams,
  res: ServerResponse,
): Promise<void> {
  // O que é nosso não vai pro SoundCloud.
  const encaminhar = new URLSearchParams(query);
  encaminhar.delete('alvo');
  encaminhar.delete('u');
  const qs = encaminhar.toString();

  const destino = `${ALVOS[alvo]}${caminho}${qs ? `?${qs}` : ''}`;

  const upstream = await fetch(destino, {
    redirect: 'follow',
    headers: {
      'user-agent': UA,
      accept:
        alvo === 'web'
          ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          : 'application/json,text/plain,*/*',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://soundcloud.com/',
    },
  });

  const corpo = await upstream.text();

  res.statusCode = upstream.status;
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Mesma origem em produção, mas de graça se algum outro host apontar aqui.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(corpo);
}
