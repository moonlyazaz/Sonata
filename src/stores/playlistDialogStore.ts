import { create } from 'zustand';
import type { UserPlaylist } from './libraryStore';

/**
 * Abre o modal de playlist a partir de qualquer lugar.
 *
 * O modal é montado num único host no AppShell porque `position: fixed` é
 * contido por qualquer ancestral com `backdrop-filter` — e todo painel de
 * vidro tem. Dentro da Sidebar, o diálogo inteiro ficaria preso na caixa
 * lateral e cortado por `overflow: hidden`.
 */
interface PlaylistDialogState {
  open: boolean;
  /** preenchida → edição; vazia → criação */
  playlist: UserPlaylist | null;
  /** roda depois de criar (ex.: colocar dentro a faixa escolhida) */
  afterCreate: ((id: string) => void) | null;
  show: (opts?: { playlist?: UserPlaylist; afterCreate?: (id: string) => void }) => void;
  hide: () => void;
}

export const usePlaylistDialogStore = create<PlaylistDialogState>((set) => ({
  open: false,
  playlist: null,
  afterCreate: null,
  show: (opts = {}) =>
    set({
      open: true,
      playlist: opts.playlist ?? null,
      afterCreate: opts.afterCreate ?? null,
    }),
  hide: () => set({ open: false, playlist: null, afterCreate: null }),
}));
