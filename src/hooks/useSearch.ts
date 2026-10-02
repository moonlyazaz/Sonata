import { useEffect, useRef, useState } from 'react';
import { sc, type ScPlaylist, type ScTrack, type ScUser } from '@/lib/soundcloud';

export type SearchTab = 'all' | 'tracks' | 'artists' | 'playlists';

export interface SearchResults {
  tracks: ScTrack[];
  artists: ScUser[];
  playlists: ScPlaylist[];
}

const EMPTY: SearchResults = { tracks: [], artists: [], playlists: [] };

/** Cache simples em memória para não bater a API a cada tecla. */
const cache = new Map<string, SearchResults>();

interface UseSearchState {
  results: SearchResults;
  loading: boolean;
  error: string | null;
}

/**
 * Busca no SoundCloud com cancelamento de requisições obsoletas.
 * O termo vem da URL (a TopBar já faz o debounce de 300ms).
 */
export function useSearch(q: string, tab: SearchTab): UseSearchState {
  const [state, setState] = useState<UseSearchState>({
    results: EMPTY,
    loading: false,
    error: null,
  });
  const requestId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setState({ results: EMPTY, loading: false, error: null });
      return;
    }

    const key = `${term}::${tab}`;
    const hit = cache.get(key);
    if (hit) {
      setState({ results: hit, loading: false, error: null });
      return;
    }

    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const wantTracks = tab === 'all' || tab === 'tracks';
        const wantArtists = tab === 'all' || tab === 'artists';
        const wantPlaylists = tab === 'all' || tab === 'playlists';

        const [t, a, p] = await Promise.all([
          wantTracks ? sc.searchTracks(term, tab === 'all' ? 12 : 30) : null,
          wantArtists ? sc.searchUsers(term, tab === 'all' ? 6 : 24) : null,
          wantPlaylists ? sc.searchPlaylists(term, tab === 'all' ? 6 : 24) : null,
        ]);

        if (id !== requestId.current) return; // resposta obsoleta

        const results: SearchResults = {
          tracks: (t?.collection ?? []).filter((x) => x?.media?.transcodings?.length),
          artists: a?.collection ?? [],
          playlists: p?.collection ?? [],
        };
        cache.set(key, results);
        setState({ results, loading: false, error: null });
      } catch (err) {
        if (id !== requestId.current) return;
        setState({
          results: EMPTY,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    // não limpamos o cache aqui: ele vive durante a sessão
  }, [q, tab]);

  return state;
}

/** Limpa o cache de busca (usado em testes/debug). */
export function clearSearchCache(): void {
  cache.clear();
}
