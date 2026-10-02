import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { serveApi } from './server/serve.js';

/**
 * A API em dev.
 *
 * Em produção as rotas vivem em `api/*.ts` e a Vercel as executa isoladas. Aqui
 * não temos um segundo processo — o mesmo `serveApi` vira um middleware do Vite,
 * na mesma origem, então o cookie de sessão funciona igual nos dois ambientes.
 *
 * O `configureServer` **sem** função de retorno roda antes dos middlewares
 * internos do Vite, que é o que queremos: `/api/*` é atendido antes do
 * fallback de SPA.
 */
function apiPlugin(): Plugin {
  return {
    name: 'sonata-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }
        void serveApi(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // `loadEnv(..., '')` com prefixo vazio lê o `.env` inteiro — inclusive as
  // variáveis SEM o prefixo `VITE_`, que o Vite nunca expõe ao navegador.
  // Aqui é onde elas entram no `process.env` para o código de `server/`.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [apiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // Sem `server.proxy`: o proxy do SoundCloud vive em `server/sc.ts` e chega
      // aqui pelo `apiPlugin`, igual chega na Vercel.
    },
  };
});
