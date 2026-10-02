import { Check, ListMusic, Plus } from 'lucide-react';
import { GlassButton } from '@/components/glass';
import { GlassModal } from '@/components/glass/GlassModal';
import { bigArtwork } from '@/lib/soundcloud';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlaylistDialogStore } from '@/stores/playlistDialogStore';
import { usePlaylistMenuStore } from '@/stores/playlistMenuStore';

/**
 * Modal "Adicionar à playlist" — aberto pelo `TrackRow`.
 * Clicar numa playlist alterna: entra (✓) / sai (✓ some), então dá pra
 * desfazer sem fechar. Criando por aqui, a faixa já vai junto.
 */
export function AddToPlaylistMenu() {
  const track = usePlaylistMenuStore((s) => s.track);
  const close = usePlaylistMenuStore((s) => s.close);

  const playlists = useLibraryStore((s) => s.playlists);
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const showPlaylistDialog = usePlaylistDialogStore((s) => s.show);

  const open = track !== null;

  return (
    <GlassModal open={open} onClose={close} title="Adicionar à playlist">
      <div className="space-y-3">
        <button
          className="glass-panel flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/10"
          onClick={() =>
            showPlaylistDialog({
              // o modal do host fica por cima deste; ao criar, a faixa entra junto
              afterCreate: (id) => {
                const pending = usePlaylistMenuStore.getState().track;
                if (pending) useLibraryStore.getState().addToPlaylist(id, pending);
                close();
              },
            })
          }
        >
          <span className="text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/8">
            <Plus size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Nova playlist</span>
            <span className="text-faint block truncate text-xs">Começa do zero</span>
          </span>
        </button>

        {playlists.length === 0 ? (
          <p className="text-faint px-1 py-4 text-center text-sm">
            Você ainda não tem playlists. Crie a primeira acima.
          </p>
        ) : (
          <ul className="glass-scroll max-h-[46vh] space-y-1 overflow-y-auto pr-1">
            {playlists.map((p) => {
              const inside = track ? p.tracks.some((t) => t.id === track.id) : false;
              const cover =
                bigArtwork(p.cover, 'badge') ?? p.tracks[0]?.user.avatar_url ?? null;

              return (
                <li key={p.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                      inside ? 'bg-white/8' : 'hover:bg-white/6'
                    }`}
                    onClick={() => {
                      if (!track) return;
                      if (inside) removeFromPlaylist(p.id, track.id);
                      else addToPlaylist(p.id, track);
                    }}
                    aria-pressed={inside}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
                        <ListMusic size={16} className="text-faint" />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="text-faint block truncate text-xs">
                        {p.tracks.length} {p.tracks.length === 1 ? 'faixa' : 'faixas'}
                      </span>
                    </span>

                    {inside && (
                      <span className="text-accent flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <Check size={16} /> Na playlist
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <GlassButton type="button" onClick={close}>
            Concluído
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
