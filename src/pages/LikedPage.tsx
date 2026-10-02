import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Shuffle } from 'lucide-react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { TrackRow } from '@/components/music/TrackRow';
import { usePlayList } from '@/hooks/usePlayList';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { formatDuration } from '@/lib/format';
import { storedToTrack } from '@/lib/stored';

/** Tela de músicas curtidas. */
export function LikedPage() {
  const navigate = useNavigate();
  const likedIds = useLibraryStore((s) => s.likedIds);
  const likedTracks = useLibraryStore((s) => s.likedTracks);

  const tracks = useMemo(
    () => likedIds.map((id) => likedTracks[id]).filter(Boolean).map(storedToTrack),
    [likedIds, likedTracks],
  );

  const playList = usePlayList('Curtidas');
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playAll = usePlayerStore((s) => s.playTrack);

  const totalSec = tracks.reduce((acc, t) => acc + t.duration / 1000, 0);

  if (tracks.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div
          className="glass-panel flex h-20 w-20 items-center justify-center"
          style={{ borderRadius: 'var(--radius-xl)' }}
        >
          <span className="relative z-10 text-accent">
            <Heart size={34} />
          </span>
        </div>
        <h1 className="text-2xl font-bold">Nenhuma música curtida ainda</h1>
        <p className="text-muted max-w-sm text-sm leading-relaxed">
          Toque no coração de qualquer música para guardar aqui. Sua coleção fica salva neste
          navegador.
        </p>
        <GlassButton variant="accent" onClick={() => navigate('/search')}>
          Explorar músicas
        </GlassButton>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <header
        className="glass-panel flex flex-col gap-5 p-6 sm:flex-row sm:items-end"
        style={{ background: 'linear-gradient(135deg, rgba(2,132,199,.5), rgba(56,189,248,.28))' }}
      >
        <div
          className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#0284c7,#38bdf8)' }}
        >
          <Heart size={52} fill="#fff" color="#fff" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Playlist</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-5xl">Curtidas</h1>
          <p className="text-muted mt-3 text-sm">
            {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'} ·{' '}
            {formatDuration(totalSec)}
          </p>
        </div>

        <div className="flex gap-3">
          <GlassButton
            variant="accent"
            size="lg"
            onClick={() => tracks[0] && void playAll(tracks[0], tracks, 'Curtidas')}
          >
            <Play size={18} fill="currentColor" /> Tocar
          </GlassButton>
          <GlassButton
            size="lg"
            onClick={() => {
              if (tracks.length === 0) return;
              const random = tracks[Math.floor(Math.random() * tracks.length)];
              void playAll(random, [...tracks].sort(() => Math.random() - 0.5), 'Curtidas');
            }}
          >
            <Shuffle size={18} /> Aleatório
          </GlassButton>
        </div>
      </header>

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
              contextLabel="Curtidas"
              onPlay={(track) => playList(track, tracks, 'Curtidas')}
              onArtistClick={(id) => navigate(`/artist/${id}`)}
            />
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
