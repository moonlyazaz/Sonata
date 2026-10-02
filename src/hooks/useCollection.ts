import { useEffect, useState } from 'react';
import {
  resolveTracks,
  sc,
  type ScPlaylist,
  type ScTrack,
  type ScUser,
} from '@/lib/soundcloud';

/* ------------------------------------------------------------------ */
/* Playlist / Álbum                                                     */
/* ------------------------------------------------------------------ */

export interface CollectionState {
  playlist: ScPlaylist | null;
  tracks: ScTrack[];
  loading: boolean;
  error: string | null;
}

/**
 * Carrega uma playlist/álbum pelo id.
 *
 * No SoundCloud as duas são a mesma entidade (`is_album` distingue), então
 * `/album/:id` e `/playlist/:id` passam por aqui.
 */
export function useCollection(id: string | undefined): CollectionState {
  const [state, setState] = useState<CollectionState>({
    playlist: null,
    tracks: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ playlist: null, tracks: [], loading: false, error: 'ID ausente' });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const playlist = await sc.playlist(id);
        const tracks = await resolveTracks(playlist);
        if (cancelled) return;
        setState({ playlist, tracks, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          playlist: null,
          tracks: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

/* ------------------------------------------------------------------ */
/* Artista                                                             */
/* ------------------------------------------------------------------ */

export interface ArtistState {
  artist: ScUser | null;
  topTracks: ScTrack[];
  playlists: ScPlaylist[];
  loading: boolean;
  error: string | null;
}

/**
 * Carrega artista + top tracks + playlists.
 *
 * As três chamadas são independentes: se `/playlists` falhar ainda assim
 * mostramos as faixas (o mais importante). `related` não existe na API — 404.
 */
export function useArtist(id: string | undefined): ArtistState {
  const [state, setState] = useState<ArtistState>({
    artist: null,
    topTracks: [],
    playlists: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ artist: null, topTracks: [], playlists: [], loading: false, error: 'ID ausente' });
      return;
    }

    let cancelled = false;
    setState({ artist: null, topTracks: [], playlists: [], loading: true, error: null });

    const numId = Number(id);

    (async () => {
      const [artistRes, topRes, plRes, alRes] = await Promise.allSettled([
        sc.artist(numId),
        sc.artistTopTracks(numId, 30),
        sc.artistPlaylists(numId, 50),
        sc.artistAlbums(numId, 50),
      ]);

      if (cancelled) return;

      if (artistRes.status === 'rejected') {
        setState({
          artist: null,
          topTracks: [],
          playlists: [],
          loading: false,
          error: artistRes.reason instanceof Error
            ? artistRes.reason.message
            : String(artistRes.reason),
        });
        return;
      }

      // `/playlists` e `/albums` se sobrepõem bastante → dedupe por id
      const merged = new Map<number, ScPlaylist>();
      for (const page of [plRes, alRes]) {
        if (page.status !== 'fulfilled') continue;
        for (const p of page.value.collection ?? []) merged.set(p.id, p);
      }

      setState({
        artist: artistRes.value,
        topTracks: topRes.status === 'fulfilled' ? topRes.value.collection ?? [] : [],
        // álbuns primeiro — é o que o usuário costuma procurar
        playlists: [...merged.values()].sort(
          (a, b) => Number(b.is_album ?? 0) - Number(a.is_album ?? 0),
        ),
        loading: false,
        // falha parcial não pode esconder a página
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
