/**
 * Cliente da API pública do SoundCloud (api-v2), via proxy da própria Sonata.
 *
 * A API exige um `client_id` que rotaciona. Em vez de fixá-lo no código,
 * descobrimos ele na home do SoundCloud (`/api/sc?alvo=web`) — a resposta traz
 * `window.__sc_hydration` com `{hydratable: "apiClient", data: {id: "..."}}`.
 *
 * Endpoints usados (todos testados ao vivo):
 *   GET /search                 → mistura tracks, users, playlists, albums
 *   GET /search/tracks          → só músicas
 *   GET /mixed-selections       → seções curadas da home
 *   GET /playlists/{id}         → playlist com faixas completas
 *   GET /system-playlists/{urn} → playlist de sistema (só IDs)
 *   GET /tracks?ids=a,b,c        → resolução em lote
 *   GET /users/{id}/tracks      → faixas de um artista
 *   GET /media/{urn}/stream/progressive → URL assinada do MP3 completo
 */

// Um único endpoint: a Vercel não faz catch-all fora do Next (o `[...path]`
// vira segmento único), então o alvo e o caminho do SoundCloud viajam na query
// string em vez de no path. Rota exata, sem dinâmica nenhuma.
// Mesmo código nos dois ambientes: middleware do Vite em dev, `api/sc.ts` lá.
const SC = '/api/sc';

type Alvo = 'api' | 'web';

/** `/api/sc?alvo=api&u=/search/tracks&client_id=…` */
function montarUrl(
  alvo: Alvo,
  caminho: string,
  params: Record<string, string | number> = {},
  id?: string,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  qs.set('alvo', alvo);
  qs.set('u', caminho);
  if (id) qs.set('client_id', id);
  return `${SC}?${qs}`;
}

/* ------------------------------------------------------------------ */
/* client_id                                                           */
/* ------------------------------------------------------------------ */

let clientId: string | null = null;
let pendingId: Promise<string> | null = null;

async function fetchClientId(): Promise<string> {
  const res = await fetch(montarUrl('web', '/'));
  if (!res.ok) throw new Error(`SoundCloud home ${res.status}`);

  const html = await res.text();

  // Padrão 1: hydration embutido na home (o oficial, usado pelo próprio player)
  const hydration = html.match(
    /"hydratable"\s*:\s*"apiClient"\s*,\s*"data"\s*:\s*\{\s*"id"\s*:\s*"([A-Za-z0-9]+)"/,
  );
  if (hydration?.[1]) return hydration[1];

  // Padrão 2: client_id:"..." nos bundles JS (fallback)
  const bundle = html.match(/client_id\s*[:=]\s*"([A-Za-z0-9]{30,50})"/);
  if (bundle?.[1]) return bundle[1];

  throw new Error('client_id do SoundCloud não encontrado na home');
}

/** Obtém o client_id, com deduplicação de requisições concorrentes. */
async function getClientId(force = false): Promise<string> {
  if (clientId && !force) return clientId;
  if (!pendingId) {
    pendingId = fetchClientId()
      .then((id) => {
        clientId = id;
        pendingId = null;
        return id;
      })
      .catch((err) => {
        pendingId = null;
        throw err;
      });
  }
  return pendingId;
}

/** Zera o client_id (chamado quando a API devolve 401/403). */
function invalidateClientId(): void {
  clientId = null;
}

/* ------------------------------------------------------------------ */
/* fetch genérico                                                      */
/* ------------------------------------------------------------------ */

async function request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const build = (id: string) => montarUrl('api', path, params, id);

  let id = await getClientId();
  let res = await fetch(build(id));

  // client_id expirou → redescobre uma vez
  if (res.status === 401 || res.status === 403) {
    invalidateClientId();
    id = await getClientId(true);
    res = await fetch(build(id));
  }

  if (!res.ok) throw new Error(`SoundCloud API ${res.status}: ${path}`);

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida da SoundCloud: ${path}`);
  }
}

/* ------------------------------------------------------------------ */
/* tipos                                                               */
/* ------------------------------------------------------------------ */

export interface ScUser {
  id: number;
  username: string;
  full_name?: string;
  avatar_url?: string;
  followers_count?: number;
  followings_count?: number;
  track_count?: number;
  playlist_count?: number;
  likes_count?: number;
  permalink_url?: string;
  /** `/users/{id}` devolve; em resultados de busca pode vir vazio */
  description?: string | null;
  city?: string | null;
  country_code?: string | null;
  created_at?: string;
}

export interface ScTranscoding {
  url: string;
  preset: string;
  /** Em alguns endpoints vem no topo; em outros dentro de `format`. */
  protocol?: string;
  mime_type?: string;
  format?: { protocol: string; mime_type: string };
  quality?: string;
  snipped?: boolean;
}

export interface ScTrack {
  id: number;
  kind: 'track';
  title: string;
  duration: number; // ms
  artwork_url: string | null;
  permalink_url?: string;
  genre?: string;
  playback_count?: number;
  likes_count?: number;
  comment_count?: number;
  created_at?: string;
  description?: string;
  downloadable?: boolean;
  streamable?: boolean;
  user: ScUser;
  media?: { transcodings: ScTranscoding[] };
}

export interface ScPlaylist {
  id: number;
  kind: 'playlist' | 'system-playlist';
  title: string;
  description?: string | null;
  artwork_url?: string | null;
  track_count?: number;
  duration?: number;
  created_at?: string;
  user?: ScUser;
  /** SoundCloud usa a mesma entidade para playlist e álbum. */
  is_album?: boolean;
  set_type?: string | null;
  release_date?: string | null;
  genre?: string;
  likes_count?: number;
  permalink_url?: string;
  /** em /playlists/{id} vem completo; em system-playlists vem só {id, kind} */
  tracks?: Array<ScTrack | ScTrackStub>;
}

/** Stub retornado por system-playlists — precisa de /tracks?ids= */
export interface ScTrackStub {
  id: number;
  kind: 'track';
  policy?: string;
}

export interface ScSelection {
  id: string;
  title: string;
  description?: string;
  /** Na API real `items` é um único objeto paginado, não um array. */
  items: {
    collection?: Array<ScPlaylist | ScTrackStub>;
    query_urn?: string;
    next_href?: string;
  };
}

export interface ScPage<T> {
  collection: T[];
  next_href?: string | null;
}

/** Item misto retornado por /search */
export type ScSearchItem = ScTrack | ScUser | ScPlaylist;

/* ------------------------------------------------------------------ */
/* endpoints                                                           */
/* ------------------------------------------------------------------ */

function isTrack(x: ScSearchItem): x is ScTrack {
  return (x as ScTrack).kind === 'track';
}

export const sc = {
  /** Busca geral (tracks + users + playlists misturados, como o Discover) */
  search: (q: string, limit = 20) => request<ScPage<ScSearchItem>>('/search', { q, limit }),

  /** Busca só de músicas */
  searchTracks: (q: string, limit = 25) => request<ScPage<ScTrack>>('/search/tracks', { q, limit }),

  searchUsers: (q: string, limit = 10) => request<ScPage<ScUser>>('/search/users', { q, limit }),

  searchPlaylists: (q: string, limit = 10) =>
    request<ScPage<ScPlaylist>>('/search/playlists', { q, limit }),

  /** Seções curadas da home do SoundCloud */
  mixedSelections: () => request<ScPage<ScSelection>>('/mixed-selections'),

  /** Playlist normal, com faixas completas */
  playlist: (id: number | string) =>
    request<ScPlaylist>(`/playlists/${encodeURIComponent(String(id))}`),

  /** Playlist de sistema (trending etc) — devolve só IDs de faixa */
  systemPlaylist: (urn: string) => request<ScPlaylist>(`/system-playlists/${urn}`),

  /** Resolve IDs em lote (usado após system-playlists) */
  tracksByIds: async (ids: Array<number | string>): Promise<ScTrack[]> => {
    if (ids.length === 0) return [];
    // a API aceita poucos IDs por request — fatiamos em 50
    const chunks: Array<Array<number | string>> = [];
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
    const results = await Promise.all(
      chunks.map((chunk) =>
        request<ScTrack[]>('/tracks', { ids: chunk.join(',') }),
      ),
    );
    return results.flat().filter(Boolean);
  },

  artist: (id: number) => request<ScUser>(`/users/${id}`),

  /** Top 30 do artista (endpoint /users/{id}/toptracks) */
  artistTopTracks: (id: number, limit = 30) =>
    request<ScPage<ScTrack>>(`/users/${id}/toptracks`, { limit }),

  artistTracks: (id: number, limit = 30) =>
    request<ScPage<ScTrack>>(`/users/${id}/tracks`, { limit }),

  /**
   * Playlists e álbuns do artista.
   *
   * ATENÇÃO (testado ao vivo): `/users/{id}/playlists` e `/users/{id}/albums`
   * devolvem coleção VAZIA para `limit` baixo (limit=5 → 0 itens, limit=20 → 8,
   * limit=50 → 15). Use `limit=50`. `linked_partitioning=1` também zera a
   * resposta — não usar.
   */
  artistPlaylists: (id: number, limit = 50) =>
    request<ScPage<ScPlaylist>>(`/users/${id}/playlists`, { limit }),

  artistAlbums: (id: number, limit = 50) =>
    request<ScPage<ScPlaylist>>(`/users/${id}/albums`, { limit }),
};

/* ------------------------------------------------------------------ */
/* resolução de stream (MP3 completo)                                  */
/* ------------------------------------------------------------------ */

interface MediaResponse {
  url: string;
}

const streamCache = new Map<number, string>();

/**
 * Resolve a URL assinada do MP3 progressivo de uma faixa.
 * A URL expira em ~5h, por isso fazemos cache com validade conservadora.
 *
 * A API muda a forma do transcoding entre endpoints: em umas `protocol`/`mime_type`
 * são diretos, em outras estão aninhados em `format`. Normalizamos os dois casos.
 */
export async function resolveStream(track: ScTrack): Promise<string> {
  const cached = streamCache.get(track.id);
  if (cached) return cached;

  const transcodings = track.media?.transcodings ?? [];
  const protocolOf = (t: ScTranscoding) => t.protocol ?? t.format?.protocol;
  const mimeOf = (t: ScTranscoding) => t.mime_type ?? t.format?.mime_type;

  const progressive = transcodings.find(
    (t) => protocolOf(t) === 'progressive' && mimeOf(t) === 'audio/mpeg',
  );
  if (!progressive) {
    // fallback: HLS (precisa de hls.js — fora do escopo por ora)
    throw new Error(`Faixa "${track.title}" sem transcoding progressivo`);
  }

  // A URL do transcoding já vem absoluta e aponta para api-v2 — reescrevemos
  // para passar pelo proxy.
  const path = progressive.url.replace('https://api-v2.soundcloud.com', '');
  const data = await request<MediaResponse>(path);

  streamCache.set(track.id, data.url);
  return data.url;
}

/** Limpa o cache de streams (útil se uma URL expirar). */
export function invalidateStream(trackId: number): void {
  streamCache.delete(trackId);
}

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */

/** artwork_url do SoundCloud é `...-large.jpg`; trocamos para `t500x500`. */
export function bigArtwork(url: string | null | undefined, size = 't500x500'): string | null {
  if (!url) return null;
  return url.replace('-large', `-${size}`);
}

/** Normaliza uma faixa vinda como stub (id-only) — precisa de tracksByIds. */
export function isTrackStub(
  t: ScTrack | ScTrackStub,
): t is ScTrackStub {
  return !('title' in t) || !t.title;
}

/**
 * Garante que as faixas de uma playlist estão completas.
 * `system-playlists` devolvem só `{id}` e exigem `/tracks?ids=` em lotes de 50;
 * `/playlists/{id}` já traz tudo — nesse caso não há nenhuma chamada extra.
 * A ordem original é preservada.
 */
export async function resolveTracks(playlist: ScPlaylist): Promise<ScTrack[]> {
  const raw = playlist.tracks ?? [];
  if (raw.length === 0) return [];

  const stubs = raw.filter(isTrackStub);
  let byId = new Map<number, ScTrack>();
  if (stubs.length > 0) {
    const fetched = await sc.tracksByIds(stubs.map((s) => s.id));
    byId = new Map(fetched.map((t) => [t.id, t]));
  }

  return raw
    .map((t) => (isTrackStub(t) ? byId.get(t.id) : t))
    .filter((t): t is ScTrack => Boolean(t && t.title));
}

export { isTrack };
