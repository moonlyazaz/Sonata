import { serveApi } from '../../server/serve';

/** `GET /api/auth/me` — quem é o usuário da sessão atual (401 se não houver). */
export default serveApi;
