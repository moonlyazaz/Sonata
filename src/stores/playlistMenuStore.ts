import { create } from 'zustand';
import type { StoredTrack } from './libraryStore';

/**
 * Guarda a faixa que está esperando pra entrar numa playlist.
 *
 * Um único modal é aberto por todo o app a partir de qualquer `TrackRow` —
 * cada linha criar seu próprio dropdown exigiria reposicionar overlay na
 * rolagem e duplicar a lógica de clique fora.
 */
interface PlaylistMenuState {
  track: StoredTrack | null;
  open: (track: StoredTrack) => void;
  close: () => void;
}

export const usePlaylistMenuStore = create<PlaylistMenuState>((set) => ({
  track: null,
  open: (track) => set({ track }),
  close: () => set({ track: null }),
}));
