import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListMusic, Pencil, Play, Shuffle, Trash2 } from 'lucide-react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { TrackRow } from '@/components/music/TrackRow';
import { PlaylistModal } from '@/components/playlist/PlaylistModal';
import { usePlayList } from '@/hooks/usePlayList';
import { formatDuration } from '@/lib/format';
import { bigArtwork } from '@/lib/soundcloud';
import { storedToTrack } from '@/lib/stored';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Página de uma playlist criada por você (ids `pl_*`).
 *
 * Não existe na API do SoundCloud — os dados vêm do localStorage. Antes de
 * existir esta tela, a Sidebar já linkava pra `/playlist/pl_...`, que caía no
 * `CollectionPage` e terminava num 404 da API.
 */
export function UserPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const playlist = useLibraryStore((s) => s.playlists.find((p) => p.id === id));
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const clearPlaylist = useLibraryStore((s) => s.clearPlaylist);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tracks = useMemo(
    () => (playlist ? playlist.tracks.map(storedToTrack) : []),
    [playlist],
  );

  const playList = usePlayList(playlist?.name ?? 'Playlist');
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playAll = usePlayerStore((s) => s.playTrack);

  const totalSec = tracks.reduce((acc, t) => acc + t.duration / 1000, 0);

  /* -------- estados de ausência -------- */

  if (!playlist) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div
          className="glass-panel flex h-20 w-20 items-center justify-center"
          style={{ borderRadius: 'var(--radius-xl)' }}
        >
          <span className="relative z-10 text-accent">
            <ListMusic size={34} />
          </span>
        </div>
        <h1 className="text-2xl font-bold">Playlist não encontrada</h1>
        <p className="text-muted max-w-sm text-sm leading-relaxed">
          Ela foi criada neste navegador e pode ter sido excluída.
        </p>
        <GlassButton variant="accent" onClick={() => navigate('/library')}>
          Ir para a biblioteca
        </GlassButton>
      </div>
    );
  }

  const cover = bigArtwork(playlist.cover, 't500x500') ?? null;

  return (
    <div className="space-y-6 py-6">
      <header
        className="glass-panel flex flex-col gap-5 p-6 sm:flex-row sm:items-end"
        style={{ background: 'linear-gradient(135deg, rgba(56,189,248,.42), rgba(2,132,199,.3))' }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-32 w-32 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/20"
          />
        ) : (
          <div
            className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl shadow-2xl"
            style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)' }}
          >
            <ListMusic size={52} color="#fff" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Playlist</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-5xl">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-muted mt-2 text-sm">{playlist.description}</p>
          )}
          <p className="text-muted mt-3 text-sm">
            {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
            {tracks.length > 0 && <> · {formatDuration(totalSec)}</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <GlassButton
            variant="accent"
            size="lg"
            disabled={tracks.length === 0}
            onClick={() => tracks[0] && void playAll(tracks[0], tracks, playlist.name)}
          >
            <Play size={18} fill="currentColor" /> Tocar
          </GlassButton>
          <GlassButton
            size="lg"
            disabled={tracks.length === 0}
            onClick={() => {
              const random = tracks[Math.floor(Math.random() * tracks.length)];
              void playAll(random, [...tracks].sort(() => Math.random() - 0.5), playlist.name);
            }}
          >
            <Shuffle size={18} /> Aleatório
          </GlassButton>
          <GlassButton size="lg" onClick={() => setEditing(true)}>
            <Pencil size={16} /> Editar
          </GlassButton>
        </div>
      </header>

      {tracks.length === 0 ? (
        <GlassPanel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-lg font-semibold">Playlist vazia</p>
          <p className="text-muted max-w-md text-sm leading-relaxed">
            Passe o mouse sobre qualquer música e toque no ícone de pasta com “+” para
            adicioná-la aqui.
          </p>
          <GlassButton onClick={() => navigate('/search')}>Procurar músicas</GlassButton>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-2">
          <ul>
            {tracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i + 1}
                recordRecent={false}
                isCurrent={currentId === t.id}
                isPlaying={isPlaying}
                contextLabel={playlist.name}
                onPlay={(track) => playList(track, tracks, playlist.name)}
                onArtistClick={(artistId) => navigate(`/artist/${artistId}`)}
                onRemove={() => removeFromPlaylist(playlist.id, t.id)}
              />
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* área destrutiva — separada pra não acionar sem querer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <button
          className="text-muted hover:text text-sm underline-offset-4 hover:underline"
          disabled={tracks.length === 0}
          onClick={() => clearPlaylist(playlist.id)}
        >
          Esvaziar playlist
        </button>

        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Excluir “{playlist.name}”?</span>
            <button
              className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
              onClick={() => {
                deletePlaylist(playlist.id);
                navigate('/library');
              }}
            >
              Excluir
            </button>
            <button
              className="text-muted hover:text px-2 py-1.5 text-xs transition"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            className="flex items-center gap-1.5 text-sm text-red-400/90 underline-offset-4 transition hover:text-red-400 hover:underline"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} /> Excluir playlist
          </button>
        )}
      </div>

      <PlaylistModal open={editing} onClose={() => setEditing(false)} playlist={playlist} />
    </div>
  );
}
