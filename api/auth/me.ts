import { serveApi } from '../../server/serve.js';

/** `GET /api/auth/me` — quem é o usuário da sessão atual (401 se não houver). */
export default serveApi;
