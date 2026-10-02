import { serveApi } from '../../server/serve.js';

/**
 * `/api/sc/api/*` → api-v2.soundcloud.com
 * `/api/sc/web*`  → soundcloud.com
 *
 * Catch-all porque o caminho do SoundCloud precisa chegar inteiro na função —
 * o `serveApi` é quem separa o alvo do caminho (`server/sc.ts`).
 */
export default serveApi;
