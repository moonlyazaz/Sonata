# Sonata 🎵

Streaming de música com **MP3 completo**, interface **Liquid Glass** e contas com dados salvos na nuvem.

O Sonata toca músicas de verdade buscadas no SoundCloud (sem chave de API), tem fila, playlists, curtidas, busca, expand player — e tudo o que você curte fica guardado **na sua conta**, no Postgres do Neon. Troca de navegador, entra de novo e continua na mesma faixa.

---

## Funcionalidades

- **Player completo** — tocar/pausar, anterior/próxima, fila, busca da posição, volume, repetir e embaralhar
- **Expanded player** — tela cheia com capa grande, fila ao lado e todos os controles
- **Página Início** — curadoria do SoundCloud + "Em alta agora"
- **Busca** — abas *Tudo · Músicas · Artistas · Playlists*, com histórico de termos
- **Biblioteca** — suas playlists e coleções
- **Curtidas** — favoritos com capa automática
- **Playlists** — criar, renomear, adicionar e remover faixas
- **Páginas de artista, álbum e playlist** com faixas e reprodução
- **Contas** — cadastro, login e logout com sessão em cookie `httpOnly`
- **Foto de perfil** — o próprio navegador reduz para 160×160 WebP antes de enviar
- **Sincronização** — curtidas, playlists, histórico, volume, última faixa e buscas ficam no Neon e voltam em qualquer dispositivo
- **Restauração** — ao abrir, volta na faixa em que você parou

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 18 · TypeScript · Vite 6 |
| Estilo | Tailwind CSS v4 · CSS em camadas (`@layer`) |
| Estado | Zustand |
| Rotas | React Router v6 |
| Ícones | Lucide React |
| Animação | Framer Motion |
| Banco | Neon Postgres via `@neondatabase/serverless` (driver HTTP) |
| Deploy | Vercel (funções serverless em `api/`) |
| Música | API pública v2 do SoundCloud |

---

## Requisitos

- Node.js 18+
- Um projeto no [Neon](https://neon.tech) (plano grátis basta)

---

## Como rodar

```bash
# 1. instalar dependências
npm install

# 2. criar o arquivo de ambiente
cp .env.example .env
# edite .env e preencha DATABASE_URL e SESSION_SECRET

# 3. subir o servidor de desenvolvimento
npm run dev
```

O app abre em `http://localhost:5173`.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento com HMR |
| `npm run build` | typecheck (`tsc -b`) + build de produção em `dist/` |
| `npm run preview` | serve o `dist/` localmente |

---

## Variáveis de ambiente

Copie `.env.example` para `.env` (que está no `.gitignore`).

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | connection string do Neon. Use o host **`-pooler`** — é o que o driver HTTP `neon()` espera |
| `SESSION_SECRET` | sim | segredo do cookie de sessão. Gere um assim:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> ⚠️ **Nada disso pode ter prefixo `VITE_`.** Variáveis iniciadas com `VITE_` são embutidas no bundle do navegador e ficam visíveis para qualquer um. Estas só são lidas pelo servidor.

---

## Rotas do app

| Rota | Página |
| --- | --- |
| `/login` | cadastro e login |
| `/` | Início |
| `/search` | Buscar |
| `/library` | Biblioteca |
| `/liked` | Curtidas |
| `/album/:id` | Álbum |
| `/artist/:id` | Artista |
| `/playlist/:id` | Playlist |
| `*` | 404 |

---

## API

Todas as rotas vivem em `server/routes.ts`. Os arquivos em `api/` são *wrappers* de uma linha — o mesmo código roda no dev server e na Vercel.

| Método | Rota | O que faz |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | cria a conta e devolve a sessão |
| `POST` | `/api/auth/login` | autentica |
| `POST` | `/api/auth/logout` | encerra a sessão |
| `GET` | `/api/auth/me` | usuário da sessão atual |
| `GET` | `/api/data` | lê um item de dado da conta |
| `PUT` | `/api/data` | grava um item (write-through) |
| `POST` | `/api/data` | idem — caminho do `sendBeacon` no `pagehide` |
| `PUT` | `/api/avatar` | salva/remove a foto de perfil |
| `GET` | `/api/sc?alvo=api&u=…` | proxy da api-v2 do SoundCloud (busca, playlists, stream) |
| `GET` | `/api/sc?alvo=web&u=/` | proxy do site — descobre o `client_id` |

---

## Estrutura

```
├── api/                  # wrappers de 1 linha das funções da Vercel
├── server/               # lógica de servidor compartilhada
│   ├── db.ts             # conexão Neon + DDL
│   ├── auth.ts           # scrypt, sessões, cookie
│   ├── routes.ts         # tabela de rotas
│   └── serve.ts          # dispatcher usado no dev e na Vercel
├── src/
│   ├── app/              # shell, rotas, layout
│   ├── components/       # brand · glass · layout · music · player · playlist
│   ├── hooks/
│   ├── lib/              # soundcloud, audio, api, sync, avatar, storage
│   ├── pages/
│   ├── stores/           # Zustand (auth, player, biblioteca, diálogos)
│   └── styles/           # tokens + classes de vidro
├── public/favicon.svg
├── index.html            # splash + estilos críticos
└── vercel.json
```

---

## Banco de dados

Três tabelas:

| Tabela | Papel |
| --- | --- |
| `users` | conta, senha com hash `scrypt`, foto de perfil |
| `sessions` | apenas o **SHA-256** do token — o token cru só existe no cookie |
| `user_data` | `key → value jsonb` por usuário, espelhando o `localStorage` |

Itens sincronizados: `sc:liked`, `sc:liked:data`, `sc:playlists`, `sc:recent`, `sc:recent:data`, `sc:volume`, `sc:last-track`, `sc:searches`.

**Política de conflito:** o servidor vence. O `localStorage` local só semeia a conta quando o servidor está vazio.

**Sincronização:** escrita imediata com *debounce* de 1,2 s; ao fechar a aba, `navigator.sendBeacon` descarrega o que ficou pendente.

---

## Música

O Sonata consome a **API pública v2 do SoundCloud** — faixas em MP3 completo, sem chave de API.

- O `client_id` é descoberto em tempo de execução a partir do `window.__sc_hydration`
- O navegador nunca fala direto com o SoundCloud: o proxy fica em `server/sc.ts` e é servido por `GET /api/sc?alvo=api|web&u=…`. É o **mesmo** código nos dois ambientes — middleware do Vite em dev, função `api/sc.ts` na Vercel. O caminho vai na query string porque o `api/` da Vercel só aceita dinâmico de **um** segmento (catch-all é recurso do Next.js)
- O proxy manda um `User-Agent` fixo de desktop e segue os redirects **no servidor**: com UA de celular o SoundCloud responde 302 para `m.soundcloud.com` e o navegador derruba tudo por CORS (é por isso que não dá pra usar um rewrite externo da Vercel — ele repassa o UA do visitante)
- As URLs de stream expiram em ~5 h; o player renova sozinho
- ~3% das faixas não tocam — o player pula para a próxima automaticamente

---

## Design

- **Liquid Glass** — painéis com `backdrop-filter`, bordas de 1px e realce interno
- **Tokens em CSS** — `--accent`, `--glass-*`, `--radius-*`, `--blur-*` em `src/styles/globals.css`
- **CSS em camadas** — resets em `@layer base`, classes de vidro em `@layer components`, utilidades do Tailwind em `@layer utilities`. Essa ordem é *load-bearing*: sem ela, as classes de vidro venceriam as utilidades
- **A logo** — um círculo `#38bdf8 → #0284c7 → #082f49` com quatro barras de equalizador brancas. A **mesma** SVG aparece na splash (`index.html`), no `favicon.svg` e na sidebar/login — se mexer em uma, mexe nas três

---

## Deploy na Vercel

```bash
# 1. linkar o projeto
vercel link

# 2. cadastrar as variáveis de AMBIENTE (Production)
#    Vercel → Project → Settings → Environment Variables
#    DATABASE_URL
#    SESSION_SECRET

# 3. publicar
vercel --prod
```

Notas:

- `@neondatabase/serverless` está em `dependencies` (não `devDependencies`) de propósito — a Vercel precisa empacotá-lo
- Não há disco persistente na Vercel: **tudo** que precisa sobreviver vai para o Neon
- `vercel.json` faz rewrite de toda rota que não seja `/api/*` para o `index.html` (SPA)

---

## Licença

MIT
