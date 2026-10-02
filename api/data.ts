import { serveApi } from '../server/serve.js';

/**
 * Cada arquivo em `api/` é uma função serverless da Vercel apontando para o
 * MESMO roteador usado em dev. Não há lógica aqui de propósito: qualquer
 * duplicação entre dev e produção seria um bug esperando para nascer.
 *
 * Em dev este arquivo não é usado — o `apiPlugin` do `vite.config.ts` chama
 * `serveApi` direto no middleware.
 */
export default serveApi;
