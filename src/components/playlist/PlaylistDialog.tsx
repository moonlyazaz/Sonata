import { PlaylistModal } from './PlaylistModal';
import { usePlaylistDialogStore } from '@/stores/playlistDialogStore';

/**
 * Host único do modal de playlist.
 *
 * Fica aqui, no AppShell, longe de qualquer ancestral com `backdrop-filter`
 * (que viraria contexto de posicionamento e prenderia o `fixed` dele dentro
 * do painel). Montado depois do `AddToPlaylistMenu` para ficar por cima dele.
 */
export function PlaylistDialog() {
  const open = usePlaylistDialogStore((s) => s.open);
  const playlist = usePlaylistDialogStore((s) => s.playlist);
  const afterCreate = usePlaylistDialogStore((s) => s.afterCreate);
  const hide = usePlaylistDialogStore((s) => s.hide);

  return (
    <PlaylistModal
      open={open}
      onClose={hide}
      playlist={playlist}
      onCreated={(id) => afterCreate?.(id)}
    />
  );
}
