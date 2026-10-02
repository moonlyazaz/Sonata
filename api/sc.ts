import { serveApi } from '../server/serve.js';

/**
 * `GET /api/sc?alvo=api&u=/search/tracks&client_id=…` → api-v2.soundcloud.com
 * `GET /api/sc?alvo=web&u=/`                            → soundcloud.com
 *
 * Arquivo único e rota exata de propósito: o `api/` da Vercel só aceita
 * dinâmico de um segmento (catch-all é do Next.js), então o caminho do
 * SoundCloud viaja na query string. O `serveApi` é quem separa alvo e caminho
 * (`server/sc.ts`).
 */
export default serveApi;
