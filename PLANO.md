# 🎵 SpotifyClone — Plano de Desenvolvimento

> App web estilo Spotify com visual **Liquid Glass** (glassmorphism moderno) e
> **streaming real** de MP3 completo via API pública do SoundCloud.

---

## 1. Decisões técnicas

| Item | Escolha |
|---|---|
| Plataforma | Web app (SPA) |
| Stack | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 |
| Estado | Zustand (player, fila, biblioteca) |
| Rotas | React Router v6 |
| Ícones | Lucide React |
| Animações | Framer Motion (transições de tela/expanded player) |
| Dados | **API pública do SoundCloud (api-v2)**, sem chave |
| Persistência | localStorage (likes, playlists, volume, recentes) |

### Marca

**Nome:** Sonata (refonte de *SoundGlass* → *Prisma* → **Sonata**).

**Marca gráfica:** o **ícone nº 7 de um contato-sheet de 8 direções** — quatro
barras de equalizador dentro de uma orbe de vidro. O wordmark acompanha o
mesmo tratamento.

| Arquivo | Papel |
|---|---|
| `src/components/brand/Logo.tsx` | marca em runtime — **`<div>` de vidro**, não um `<svg>` |
| `src/styles/glass.css` (`.sonata-mark`, `.sonata-word`) | o material Liquid Glass |
| `public/favicon.svg` | versão **assada** da mesma geometria |

**Por o `Logo` ser um `<div>`:** `backdrop-filter` é propriedade CSS e não
existe em primitivas SVG. Para o vidro ser *verdadeiro* — borro e satura o que
está atrás, a sidebar ou o gradiente da home — o disco precisa ser um elemento
de caixa com o SVG das barras por cima. As barras, a sombra gravada e o aro
mantêm a geometria idêntica às do favicon; **se mexer numa, mexe na outra**.

**O favicon é a única concessão:** ele não tem backdrop para borrar, então o
corpo verde com especular e aro está pintado no próprio SVG. Sem `<filter>` —
favicons não o renderizam de forma confiável.

**Contraste das barras:** o corpo na área onde elas ficam não passa de
`~#0d8848` (L≈0,18) → ≈3,8:1 contra o branco, acima de 3:1 exigido para
gráficos. Por isso o especular é pequeno e fica fora da área das barras.

### Por que o SoundCloud?
- **Música completa** (MP3 progressivo), não preview de 30s
- Busca, playlists curadas, charts por gênero, perfis de artista — tudo público
- Sem OAuth: só um `client_id` que o próprio app descobre na home
- Testado ao vivo: **97% das faixas** resolvem stream MP3 (101 faixas testadas)

### Como a API do SoundCloud é chamada sem chave nossa
O `client_id` **não é uma chave de cadastro** — é o mesmo que o player público do
SoundCloud usa. Descobrimos em runtime:

```
GET /sc/web/          → soundcloud.com (via proxy)
  → HTML contém: {"hydratable":"apiClient","data":{"id":"<client_id>"}}
```

Se a API devolver 401/403, o cliente invalida e redescobre automaticamente.

### Limitações conhecidas
1. **~3% das faixas não tocam** — ou não têm transcoding progressivo, ou usam
   DRM FairPlay (`SAMPLE-AES` + `skd://`), que não roda em `<audio>` comum.
   → o player pula para a próxima automaticamente.
2. **CORS**: nem `soundcloud.com` nem `api-v2.soundcloud.com` enviam
   `Access-Control-Allow-Origin` → **proxy do Vite**:
   ```ts
   // vite.config.ts
   '/sc/api': { target: 'https://api-v2.soundcloud.com', rewrite: p => p.replace(/^\/sc\/api/, '') },
   '/sc/web': { target: 'https://soundcloud.com',        rewrite: p => p.replace(/^\/sc\/web/, '') },
   ```
3. **Streams expiram** (~5h, URL assinada CloudFront) → cache + renovação sob demanda.
4. URLs de imagem (`i1.sndcdn.com`) e `cf-media.sndcdn.com` já têm CORS próprio,
   então capas e áudio funcionam direto, sem passar pelo proxy.

### Endpoints confirmados (testados ao vivo)

| Endpoint | Uso | Status |
|---|---|---|
| `GET /search?q=` | busca mista (tracks, users, playlists) | ✅ |
| `GET /search/tracks?q=` | só músicas, com `media.transcodings` | ✅ |
| `GET /search/users?q=` | artistas | ✅ |
| `GET /search/playlists?q=` | playlists | ✅ |
| `GET /mixed-selections` | seções curadas da home | ✅ |
| `GET /playlists/{id}` | playlist com faixas completas | ✅ |
| `GET /system-playlists/{urn}` | trending por gênero (só IDs) | ✅ |
| `GET /tracks?ids=a,b,c` | resolução em lote (50/req) | ✅ |
| `GET /users/{id}` | perfil do artista | ✅ |
| `GET /users/{id}/toptracks` | top 30 do artista | ✅ |
| `GET /users/{id}/tracks` | faixas do artista | ✅ |
| `GET /users/{id}/playlists` | playlists do artista | ✅ |
| `GET /media/{urn}/stream/progressive` | **URL do MP3 completo** | ✅ |
| `GET /charts` | — | ❌ desativado (usa `mixed-selections`) |
| `GET /users/{id}/related` | artistas parecidos | ❌ inexistente |

> **Atenção aos detalhes da forma da resposta** (descobertos testando):
> - `items` de uma seleção é **um objeto** `{collection}`, não array
> - `protocol`/`mime_type` vêm **dentro de `format`**, não no topo
> - `system-playlists` devolve faixas como `{id, kind}` — precisa de `/tracks?ids=`
> - URLs de transcoding vêm absolutas → reescrever para `/sc/api/...`

---

## 2. Arquitetura de pastas

```
src/
├── app/
│   ├── App.tsx                 # Router + providers
│   └── routes.tsx
├── lib/
│   ├── soundcloud.ts           # Cliente api-v2 (client_id dinâmico + cache)
│   ├── format.ts               # tempo, números (1.2M)
│   ├── storage.ts              # helpers localStorage + ALL_MANAGED_KEYS
│   ├── api.ts                  # fetch da API da Sonata (cookie httpOnly)
│   ├── sync.ts                 # write-through localStorage → Neon (debounce)
│   └── boot.ts                 # sessão + hidratação ANTES das stores nascerem
├── stores/
│   ├── playerStore.ts          # faixa atual, fila, shuffle, repeat, volume
│   ├── queueStore.ts
│   ├── libraryStore.ts         # likes, playlists criadas, recentes
│   └── authStore.ts            # usuário da sessão, entrar/cadastrar/sair
├── hooks/
│   ├── useAudioEngine.ts       # ligação <audio> ↔ store + Media Session API
│   ├── useDeezer.ts            # useSearch, useChart, useAlbum, useArtist...
│   └── useKeyboardShortcuts.ts
├── components/
│   ├── glass/                  # sistema Liquid Glass (reutilizável)
│   │   ├── GlassCard.tsx
│   │   ├── GlassButton.tsx
│   │   ├── GlassPanel.tsx      # sidebar, menus, modais
│   │   ├── GlassSlider.tsx     # volume, seek
│   │   └── GlassModal.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx          # busca + navegação + avatar
│   │   ├── PlayerBar.tsx       # barra fixa inferior
│   │   ├── RightPanel.tsx      # fila / "tocando agora"
│   │   └── AppShell.tsx
│   ├── player/
│   │   ├── PlayButton.tsx
│   │   ├── SeekBar.tsx
│   │   ├── VolumeControl.tsx
│   │   ├── QueueList.tsx
│   │   └── ExpandedPlayer.tsx  # tela cheia com capa animada
│   └── music/
│       ├── TrackRow.tsx        # linha de música (nº, capa, título, duração)
│       ├── CardGrid.tsx        # grade de cards (álbuns/playlists)
│       ├── AlbumCard.tsx / ArtistCard.tsx / PlaylistCard.tsx
│       └── SectionCarousel.tsx # carrossel horizontal da home
├── pages/
│   ├── LoginPage.tsx           # login + cadastro (primeira tela do site)
│   ├── Home.tsx
│   ├── Search.tsx
│   ├── Library.tsx
│   ├── Album.tsx
│   ├── Artist.tsx
│   ├── Playlist.tsx
│   ├── LikedSongs.tsx
│   └── Profile.tsx
├── styles/
│   ├── globals.css             # tokens, blobs animados, scrollbar glass
│   └── glass.css               # utilitários .glass-*
└── main.tsx

server/                          # API — MESMO código no dev e na Vercel
├── db.ts                        # driver HTTP do Neon + DDL + MANAGED_KEYS
├── auth.ts                      # scrypt, sessões, cookies httpOnly
├── routes.ts                    # signup/login/logout/me + GET|PUT /api/data
└── serve.ts                     # adaptador node:http (um só para os dois)

api/                             # wrappers da Vercel — 1 linha por rota
├── data.ts                      # GET|POST|PUT /api/data
└── auth/{signup,login,logout,me}.ts
```

---

## 3. Direção visual — Liquid Glass

### Tokens
```css
--glass-bg:        rgba(255,255,255,.06);
--glass-bg-strong: rgba(255,255,255,.10);
--glass-border:    rgba(255,255,255,.14);
--glass-highlight: inset 0 1px 0 rgba(255,255,255,.22);
--blur-panel:      saturate(180%) blur(24px);
--blur-card:       saturate(160%) blur(12px);
--radius-lg:       24px;
--accent:          #1DB954;   /* verde Spotify */
```

### Fundo
- Base escura `#050505` + **2–3 blobs de gradiente** (verde/roxo/ciano) com
  `filter: blur(120px)` e animação lenta de deriva → dá a "vida" atrás do vidro.

### Regras do vidro
1. Todo painel: `backdrop-filter` + borda 1px clara em cima + sombra escura embaixo
2. **Highlight especular**: gradiente `rgba(255,255,255,.25 → 0)` no topo do card
3. Hover: aumenta opacidade do fundo e brilho da borda (transição 200ms)
4. Cards de capa mantêm imagem nítida, só o chrome ao redor é vidro
5. Slider/proGRESSO com "lâmina" de vidro e thumb branco luminoso

---

## 4. Funcionalidades (escopo completo)

### Fase 0 — Fundação
- [x] Scaffold Vite + TS + Tailwind v4
- [x] Tokens de tema, blobs de fundo, scrollbars custom
- [x] Sistema de componentes `glass/*` (Card, Button, Panel, Slider, Modal)
- [x] Proxy SoundCloud no `vite.config.ts` + cliente API tipado
- [x] Descoberta dinâmica de `client_id` (com retry em 401/403)

### Fase 1 — Shell de navegação
- [x] `AppShell`: Sidebar (Início, Busca, Biblioteca, Curtidas) / TopBar / área central
- [x] Rotas: `/`, `/search`, `/library`, `/liked`, `/album/:id`, `/artist/:id`, `/playlist/:id`
- [x] TopBar com busca (debounce 300ms → `/search?q=`)
- [x] Layout responsivo: sidebar encolhe em tablet, vira drawer no mobile
- [x] Home com seções curadas (`mixed-selections`) + trending por gênero
      → **limpa na Fase 6/7**: saíram o cabeçalho de marca, os cards de
        demonstração da Fase 0 (`Painel`/`Cartão`/`Controles`), o modal de
        exemplo e o campo `fresh` (que pedia `searchTracks('electronic')` e
        nunca era renderizado). Restam só **Curadoria do SoundCloud** (grade de
        15 playlists) e **Em alta agora** (10 faixas). O título da grade estava
        errado: lia o nome da 1ª playlist, então dizia "Buzzing Mexico" mesmo
        mostrando todas as curadorias juntas.

### Fase 2 — Player (coração do app) ✅ **concluída e testada**
- [x] `lib/audio.ts` (singleton `Audio` fora do React) + `startPlayer()` ligando
      eventos → store — equivalente ao `useAudioEngine` previsto
- [x] Barra fixa inferior: capa, título/artista, play/pause, anterior/próximo,
      seek bar com tempo, volume, shuffle, repeat (off/all/one)
- [x] Fila (queue) com adicionar em seguida / ao fim, remover item, limpar, pular
      para qualquer faixa + painel lateral (overlay no mobile/tablet)
- [x] Tocando atualmente com destaque (`eq-bars` animadas + texto accent no TrackRow)
- [x] `navigator.mediaSession` → metadados + 5 handlers (`play`, `pause`,
      `nexttrack`, `previoustrack`, `seekto`) no teclado/lock screen do OS
- [x] Volume persistido no localStorage
- [x] **Estado do player persistido** (`sc:last-track`): fila, índice, rótulo do
      contexto, posição, shuffle e repeat — restaurado no reload na mesma faixa
      e no mesmo ponto. Filas >40 faixas são aparadas para atual+29. A
      restauração nunca pula faixa: bloqueio de autoplay → pausa na posição
      salva; falha ao resolver → erro, não skip
- [x] Atalhos: `Space` play/pause, `←/→` ±10s, `Shift+←/→` faixa, `↑/↓` volume,
      `M` mudo, `S` shuffle, `R` ciclo de repeat, `/` foca busca, `Esc` fecha
- [x] Skip automático de faixas intransmissíveis (DRM/sem progressive), com
      limite de 6 falhas consecutivas para não entrar em loop
- [x] Renovação de stream expirado (~5h) no erro de rede
- [ ] Reordenar fila por arrasto

**Bugs corrigidos durante a testagem**
1. Condição de corrida na troca de faixa: os `timeupdate` da faixa anterior
   sobrescreviam `duration`/`currentTime` da nova (`0:10 | 4:06` no meio da troca).
2. `SeekBar` colapsava para largura 0 — estava num `flex-col` com `items-center`,
   onde `flex-1` aplica ao height; a barra virava só os dois rótulos de tempo.
3. Repeat **faixa** impedia o botão **Próxima** de avançar. Agora o repeat-one
   só vale no fim natural da faixa (`advance(skipRepeatOne)`), como no Spotify.
4. `prev()` podia setar `index: -1` (estado quebrado) na primeira faixa.
5. Atalhos disparavam duas vezes com o slider/botão focado — agora checa
   `defaultPrevented` + `isSlider` + `isActivatable` por tecla.

### Fase 3 — Descoberta (Home) — parcial
- [x] Seções curadas via `/mixed-selections` + trending por gênero
- [x] Cards clicáveis → rota; `TrackRow` com play na lista de trending
- [ ] Carrosséis: gêneros, álbuns em alta
- [ ] "Ouvidos recentemente" (localStorage)
- [ ] Saudação com hora do dia

### Fase 4 — Busca ✅ **concluída**
- [x] Debounce 300ms → `/search?q=` (tracks, artists, playlists)
- [x] Abas de filtro (Tudo/Músicas/Artistas/Playlists) sincronizadas com `?tab=`
- [x] Buscas recentes salvas (remoção individual e limpar tudo) + sugestões
- [x] Cache por `term::tab` + cancelamento de requisição obsoleta

### Fase 5 — Páginas de conteúdo ✅ **concluída e testada**
- [x] **Álbum** (`/album/:id`): capa grande, botão play, tracklist com nº/duração
- [x] **Artista** (`/artist/:id`): header com imagem, top tracks, álbuns, biografia
- [x] **Playlist do SoundCloud** (`/playlist/:id` numérico): capa, descrição, tracklist
- [x] Hook `useCollection` compartilhado pelas três páginas (resolve, normaliza,
      trata 404 e estados de carregamento/vazio)
- [x] Botão "Tocar" e "Adicionar à fila" em qualquer card/linha

### Fase 6 — Biblioteca — **playlists concluídas**
- [x] **Curtidas** (❤ → `/liked`, persistido em localStorage) — página com
      cabeçalho em gradiente, contagem, duração total, Tocar/Aleatório
- [x] **Criar playlist** (modal glass), renomear, deletar, esvaziar
- [x] `UserPlaylist` guarda `tracks: StoredTrack[]` (não só IDs — sem título e
      duração não existe linha de música pra montar); `loadPlaylists()` tolera
      payload legado e normaliza para `[]`
- [x] **`PlaylistDialog`**: host único no `AppShell`. O `position: fixed` do
      modal é contido por qualquer ancestral com `backdrop-filter` — e todo
      painel de vidro tem (`overflow: hidden` também corta). Dentro da Sidebar
      o diálogo inteiro ficaria preso na caixa lateral
- [x] `AddToPlaylistMenu`: modal global aberto pelo `TrackRow` (um só para o
      app inteiro), alterna entra/sai com ✓, cria por aqui já com a faixa junto
- [x] `/playlist/:id` bifurcado: ids `pl_*` → `UserPlaylistPage`; numéricos →
      `CollectionPage` (a Sidebar já linkava `pl_*` e caía num 404 da API)
- [x] `UserPlaylistPage`: capa derivada da 1ª faixa, contagem, duração total,
      Tocar/Aleatório/Editar, remover faixa por linha, esvaziar e excluir com
      confirmação inline
- [x] **Biblioteca** (`/library`): abas Playlists/Recentes em `?tab=` + botão
      "Nova playlist" + cartão Curtidas + estados vazios
- [x] **`+` na Sidebar** sempre visível (antes ficava dentro de
      `playlists.length > 0` — some exatamente quando você não tem playlist)
- [ ] Abas: Álbuns / Artistas curtidos (precisa de estado de seguir novo)
- [ ] Página de perfil com estatísticas simples

**Bugs corrigidos durante a Fase 6**
1. Capa não aparecia na mini barra: faixas com `artwork_url: null` viravam um
   `<div>` cinza no `PlayerBar`, enquanto o `ExpandedPlayer` já caía no avatar.
   Agora há fallback pro avatar nos dois (e nos dois pontos da `QueuePanel`).
2. `badge` (47×47) era pequeno demais → `large` (100×100 = o próprio
   `artwork_url`, nunca dá 404). `t100x100` dá 404; `t200x200`/`t500x500` ok.
3. O "+" da Sidebar só renderizava com `playlists.length > 0`.

### Fase 7 — Player avançado — parcial
- [x] `ExpandedPlayer`: sheet `glass-liquid glass-liquid--sheet` com capa grande,
      seek e os 9 controles (Fechar, Fila, Aleatória, Anterior, Play/Pausar,
      Próxima, Repetição, Curtidas, Silenciar)
- [x] PlayerBar em `glass-liquid --bar` (blur `--blur-panel`); `glass-solid` morto
- [x] Fila: painel direito no desktop, overlay no mobile/tablet
- [ ] Painel direito: "tocando agora" com crossfade visual
- [ ] Letras? → **não** (API não oferece) — no lugar: visualizador de ondas CSS

### Fase 8 — Polish
- [ ] Skeletons de carregamento com efeito de brilho
- [ ] Estados vazios ilustrados
- [ ] Micro-interações: escala no hover dos cards, ripple no play
- [ ] `prefers-reduced-motion` respeitado
- [ ] Auditoria Lighthouse (acessibilidade/perf) > 90

### Fase 9 — Contas e dados no Neon ✅ **concluída e testada**

Primeira tela do site é o login. Cada conta tem seus dados (curtidas,
playlists, histórico, fila, volume, buscas) no Postgres do Neon — o navegador
vira só cache.

**Backend** (`server/` — roda igual no dev e na Vercel)

| Arquivo | Papel |
|---|---|
| `db.ts` | `neon()` HTTP, `MANAGED_KEYS`, DDL idempotente, helper `rows<T>()` |
| `auth.ts` | senha com **scrypt** nativo (bcrypt exigiria módulo nativo e quebra no bundle da Vercel); sessão = token aleatório no cookie httpOnly, **só o SHA-256 vai para o banco** |
| `routes.ts` | signup · login · logout · me · GET/PUT `/api/data` |
| `serve.ts` | adaptador `node:http` único para dev **e** produção |

- Dev: `apiPlugin` no `vite.config.ts` monta `serveApi` como middleware — mesmo
  processo, mesma origem, cookie funciona igual.
- Produção: `api/*.ts` são wrappers de 1 linha sobre o mesmo `serveApi`.
  Sem código duplicado entre dev e produção.
- Driver **HTTP** (`neon()` sobre o endpoint pooler), não TCP: a Vercel não
  segura conexões nem tem disco.

**Schema** — `users` · `sessions` · `user_data(user_id, key, value jsonb)`.
A tabela `user_data` espelha 1:1 o `localStorage` (uma linha por chave), o que
elimina a camada de tradução no caminho mais quente do app.

**Frontend**

- `main.tsx` faz `boot()` **antes** de importar a árvore de app (import
  dinâmico): as stores leem o `localStorage` na importação do módulo, então a
  ordem é o que impede vazamento de dados entre contas.
- `lib/sync.ts` — write-through com debounce de 1,2s a partir de `save()`;
  `pagehide`/`visibilitychange` descarregam com `sendBeacon`.
- Conflito: servidor vence; migração só na primeira entrada (cache ainda sem
  dono). `sc:owner` registra de quem é o cache local.
- Entrar/cadastrar/sair recarregam a página — um único caminho de hidratação,
  já testado, em vez de um `rehydrate()` por store que alguém esqueceria.
- Login em `glass-panel` + `glass-tabs`; autofill sem fundo branco (duas
  defesas: congela o `background-color` com `transition` de 1e6 s e cobre com
  `inset box-shadow` escuro; `-webkit-text-fill-color` mantém a letra branca).

**Verificado ao vivo**: signup → migração do cache local → `apagar o
localStorage inteiro` → reload → tudo restaurado do Neon (mesma faixa, mesmo
volume) → logout (sessão destruída, 401) → login → dados de volta · write-through
de volume local→banco · 0 erros de console.

---

## 5. Ordem de execução recomendada

```
F0 Fundação ──► F1 Shell ──► F2 Player ──► F3 Home
                                      └──► F4 Busca ──► F5 Páginas ──► F6 Biblioteca
                                                              └──► F7 Expanded ──► F8 Polish
```

> O player sai cedo de propósito: cada fase seguinte já nasce "clicável e ouvível".

## 6. Como rodar

```bash
cp .env.example .env   # preencha DATABASE_URL e SESSION_SECRET
npm install
npm run dev             # http://localhost:5173
```

A busca e o player usam o proxy do SoundCloud (sem chave). O **login e a
sincronização** precisam do `.env` — só `DATABASE_URL` e `SESSION_SECRET` são
lidos pelo app; o resto do `.env.example` é documentação.

### Deploy na Vercel

```bash
npm i -g vercel && vercel link
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel --prod
```

- As funções ficam em `api/` e roteiam sozinhas; `vercel.json` já aponta
  `buildCommand`/`outputDirectory` para o Vite e faz o fallback de SPA
  (excluindo `/api/*`).
- **Nunca** use prefixo `VITE_` nessas variáveis — o Vite embute no bundle e a
  senha do Postgres ficaria pública.
- O `.env` está no `.gitignore`. Não commite `DATABASE_URL` nem a chave
  `napi_` do Neon.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Deezer limita/prejudica requests em massa | Cache de respostas em memória (react-query ou Map) |
| Preview indisponível em algumas faixas | Fallback: pular para próxima automaticamente |
| `backdrop-filter` pesado em PCs fracos | Reduzir blur em `@media (prefers-reduced-transparency)` |
| Mudança de schema da API | Tipos centrais em `lib/deezer.ts` (corrigir em 1 lugar) |
