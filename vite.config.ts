import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { serveApi } from './server/serve.js';

/**
 * Proxies para contornar CORS:
 *
 * - `/sc/api/*`  → api-v2.soundcloud.com  (busca, playlists, resolução de stream)
 * - `/sc/web/*`  → soundcloud.com         (só para descobrir o client_id na home)
 *
 * A API do SoundCloud não envia `Access-Control-Allow-Origin`, então todo
 * request de dados passa por aqui. Os streams de MP3 e os assets (imagens/JS)
 * vêm de CDN com CORS próprio e podem ser usados direto.
 */
const SC_HEADERS = {
  origin: 'https://soundcloud.com',
  referer: 'https://soundcloud.com/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

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
      proxy: {
        '/sc/api': {
          target: 'https://api-v2.soundcloud.com',
          changeOrigin: true,
          headers: SC_HEADERS,
          rewrite: (path) => path.replace(/^\/sc\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['access-control-allow-origin'] = '*';
            });
          },
        },
        '/sc/web': {
          target: 'https://soundcloud.com',
          changeOrigin: true,
          headers: SC_HEADERS,
          // `|| '/'` — o cliente pede `/sc/web` sem barra, e o alvo precisa de caminho.
          rewrite: (path) => path.replace(/^\/sc\/web/, '') || '/',
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['access-control-allow-origin'] = '*';
            });
          },
        },
      },
    },
  };
});
