import { create } from 'zustand';
import { load, save, STORAGE_KEYS } from '@/lib/storage';
import type { ScTrack } from '@/lib/soundcloud';

/** Track simplificado guardado em localStorage (só o necessário). */
export type StoredTrack = Pick<
  ScTrack,
  'id' | 'title' | 'duration' | 'artwork_url' | 'permalink_url' | 'genre' | 'user'
>;

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  /**
   * Faixas COMPLETAS, não só IDs.
   * Guardar apenas `trackIds` deixava a playlist inrenderizável: sem título e
   * duração não existe linha de música pra montar.
   */
  tracks: StoredTrack[];
  /** Capa derivada da primeira faixa. */
  cover?: string;
  createdAt: number;
}

interface LibraryState {
  likedIds: number[];
  likedTracks: Record<number, StoredTrack>;
  playlists: UserPlaylist[];
  recentIds: number[];
  recentTracks: Record<number, StoredTrack>;

  toggleLike: (track: StoredTrack) => void;
  isLiked: (id: number) => boolean;

  createPlaylist: (name: string, description?: string) => string;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, patch: { name?: string; description?: string }) => void;
  /** Retorna `false` se a faixa já estava na playlist. */
  addToPlaylist: (playlistId: string, track: StoredTrack) => boolean;
  removeFromPlaylist: (playlistId: string, trackId: number) => void;
  clearPlaylist: (id: string) => void;
  isInPlaylist: (playlistId: string, trackId: number) => boolean;

  pushRecent: (track: StoredTrack) => void;
}

function strip(track: StoredTrack): StoredTrack {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    artwork_url: track.artwork_url,
    permalink_url: track.permalink_url,
    genre: track.genre,
    user: { id: track.user.id, username: track.user.username, avatar_url: track.user.avatar_url },
  };
}

/**
 * Lê as playlists tolerando payload antigo: versões anteriores gravavam
 * `trackIds` e deixavam `tracks` ausente.
 */
function loadPlaylists(): UserPlaylist[] {
  const raw = load<UserPlaylist[]>(STORAGE_KEYS.playlists, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => Boolean(p && typeof p.id === 'string'))
    .map((p) => ({
      ...p,
      name: p.name || 'Playlist sem nome',
      description: p.description ?? '',
      tracks: Array.isArray(p.tracks) ? p.tracks : [],
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    }));
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  likedIds: load<number[]>(STORAGE_KEYS.liked, []),
  likedTracks: load<Record<number, StoredTrack>>(`${STORAGE_KEYS.liked}:data`, {}),
  playlists: loadPlaylists(),
  recentIds: load<number[]>(STORAGE_KEYS.recent, []),
  recentTracks: load<Record<number, StoredTrack>>(`${STORAGE_KEYS.recent}:data`, {}),

  toggleLike: (track) => {
    const { likedIds, likedTracks } = get();
    const exists = likedIds.includes(track.id);
    const nextIds = exists
      ? likedIds.filter((id) => id !== track.id)
      : [track.id, ...likedIds];
    const nextData = { ...likedTracks };
    if (exists) delete nextData[track.id];
    else nextData[track.id] = strip(track);

    set({ likedIds: nextIds, likedTracks: nextData });
    save(STORAGE_KEYS.liked, nextIds);
    save(`${STORAGE_KEYS.liked}:data`, nextData);
  },

  isLiked: (id) => get().likedIds.includes(id),

  createPlaylist: (name, description = '') => {
    const id = `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const playlist: UserPlaylist = {
      id,
      name: name.trim() || 'Nova playlist',
      description: description.trim(),
      tracks: [],
      createdAt: Date.now(),
    };
    const next = [playlist, ...get().playlists];
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
    return id;
  },

  deletePlaylist: (id) => {
    const next = get().playlists.filter((p) => p.id !== id);
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
  },

  updatePlaylist: (id, patch) => {
    const next = get().playlists.map((p) =>
      p.id === id
        ? {
            ...p,
            name: patch.name !== undefined ? patch.name.trim() || p.name : p.name,
            description: patch.description !== undefined ? patch.description : p.description,
          }
        : p,
    );
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
  },

  addToPlaylist: (playlistId, track) => {
    let added = false;
    const next = get().playlists.map((p) => {
      if (p.id !== playlistId || p.tracks.some((t) => t.id === track.id)) return p;
      added = true;
      const tracks = [...p.tracks, strip(track)];
      return {
        ...p,
        tracks,
        cover: p.cover ?? track.artwork_url ?? track.user.avatar_url ?? undefined,
      };
    });
    if (!added) return false;
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
    return true;
  },

  removeFromPlaylist: (playlistId, trackId) => {
    const next = get().playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const tracks = p.tracks.filter((t) => t.id !== trackId);
      // capa pode ter saído junto → recalcula a partir da nova primeira faixa
      return { ...p, tracks, cover: tracks[0]?.artwork_url ?? tracks[0]?.user.avatar_url ?? undefined };
    });
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
  },

  clearPlaylist: (id) => {
    const next = get().playlists.map((p) =>
      p.id === id ? { ...p, tracks: [], cover: undefined } : p,
    );
    set({ playlists: next });
    save(STORAGE_KEYS.playlists, next);
  },

  isInPlaylist: (playlistId, trackId) =>
    get().playlists.some((p) => p.id === playlistId && p.tracks.some((t) => t.id === trackId)),

  pushRecent: (track) => {
    const { recentIds, recentTracks } = get();
    const nextIds = [track.id, ...recentIds.filter((id) => id !== track.id)].slice(0, 20);
    const nextData = { ...recentTracks, [track.id]: strip(track) };
    set({ recentIds: nextIds, recentTracks: nextData });
    save(STORAGE_KEYS.recent, nextIds);
    save(`${STORAGE_KEYS.recent}:data`, nextData);
  },
}));
