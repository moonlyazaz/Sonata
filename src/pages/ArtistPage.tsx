import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Disc3, MapPin, Play, Shuffle, User, Users } from 'lucide-react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { MediaCard, artwork } from '@/components/music/MediaCard';
import { TrackRow } from '@/components/music/TrackRow';
import { useArtist } from '@/hooks/useCollection';
import { usePlayList } from '@/hooks/usePlayList';
import { usePlayerStore } from '@/stores/playerStore';
import { bigArtwork } from '@/lib/soundcloud';
import { formatCompact, formatDuration, hueFromId } from '@/lib/format';

/** Página do artista: identidade, faixas populares e coleções. */
export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { artist, topTracks, playlists, loading, error } = useArtist(id);

  const label = artist?.full_name || artist?.username || '';
  const playList = usePlayList(label);
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const totalSec = useMemo(
    () => topTracks.reduce((acc, t) => acc + t.duration / 1000, 0),
    [topTracks],
  );

  if (loading) return <ArtistSkeleton />;

  if (error || !artist) {
    return (
      <GlassPanel className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-lg font-semibold">Artista não encontrado</p>
        <p className="text-faint max-w-md text-sm">{error ?? 'Perfil indisponível.'}</p>
        <GlassButton onClick={() => navigate(-1)}>Voltar</GlassButton>
      </GlassPanel>
    );
  }

  const avatar = bigArtwork(artist.avatar_url, 't500x500');
  const location = [artist.city, artist.country_code].filter(Boolean).join(' · ');

  const playAll = () => {
    if (topTracks.length > 0) void playTrack(topTracks[0], topTracks, label);
  };

  const playShuffled = () => {
    if (topTracks.length === 0) return;
    const shuffled = [...topTracks].sort(() => Math.random() - 0.5);
    void playTrack(shuffled[0], shuffled, label);
  };

  return (
    <div className="space-y-6 py-6">
      {/* ---------------- cabeçalho ---------------- */}
      <header
        className="glass-panel flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-end"
        style={{
          background: `linear-gradient(135deg, hsla(${hueFromId(artist.id)}, 65%, 40%, .6), rgba(56,189,248,.22))`,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-40 w-40 shrink-0 rounded-full object-cover shadow-2xl ring-4 ring-white/20 sm:h-48 sm:w-48"
          />
        ) : (
          <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-black/30 shadow-2xl ring-4 ring-white/20 sm:h-48 sm:w-48">
            <User size={64} className="text-white/50" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">Artista</p>
          <h1 className="mt-1 text-3xl leading-tight font-bold break-words sm:text-5xl">
            {label}
          </h1>

          <p className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />
              {formatCompact(artist.followers_count ?? 0)} seguidores
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Disc3 size={14} />
              {formatCompact(artist.track_count ?? 0)} faixas
            </span>
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {location}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <GlassButton
            variant="accent"
            size="lg"
            onClick={playAll}
            disabled={topTracks.length === 0}
          >
            <Play size={18} fill="currentColor" /> Tocar
          </GlassButton>
          <GlassButton
            size="lg"
            onClick={playShuffled}
            disabled={topTracks.length === 0}
          >
            <Shuffle size={18} /> Aleatório
          </GlassButton>
        </div>
      </header>

      {/* ---------------- faixas populares ---------------- */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold">Populares</h2>
          {topTracks.length > 0 && (
            <span className="text-faint text-xs">
              {topTracks.length} faixas · {formatDuration(totalSec)}
            </span>
          )}
        </div>

        {topTracks.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <p className="text-faint text-sm">Nenhuma faixa disponível.</p>
          </GlassPanel>
        ) : (
          <GlassPanel className="p-2">
            <ul>
              {topTracks.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i + 1}
                  isCurrent={currentId === t.id}
                  isPlaying={isPlaying}
                  contextLabel={label}
                  onPlay={(track) => playList(track, topTracks, label)}
                  onArtistClick={(artistId) => navigate(`/artist/${artistId}`)}
                />
              ))}
            </ul>
          </GlassPanel>
        )}
      </section>

      {/* ---------------- biografia ---------------- */}
      {artist.description && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Sobre</h2>
          <GlassPanel className="p-5">
            <p className="text-muted max-w-3xl text-sm leading-relaxed whitespace-pre-line">
              {artist.description}
            </p>
          </GlassPanel>
        </section>
      )}

      {/* ---------------- coleções ---------------- */}
      {playlists.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Álbuns e playlists</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {playlists.map((p) => (
              <MediaCard
                key={p.id}
                image={artwork(p.artwork_url)}
                title={p.title}
                subtitle={`${p.track_count ?? 0} faixas${p.is_album ? ' · Álbum' : ''}`}
                onClick={() => navigate(`/${p.is_album ? 'album' : 'playlist'}/${p.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ArtistSkeleton() {
  return (
    <div className="space-y-6 py-6">
      <div className="glass-panel flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-end">
        <div className="glass-skeleton h-40 w-40 shrink-0 rounded-full sm:h-48 sm:w-48" />
        <div className="flex-1 space-y-3">
          <div className="glass-skeleton h-3 w-16" />
          <div className="glass-skeleton h-10 w-2/3" />
          <div className="glass-skeleton h-3 w-1/2" />
        </div>
      </div>
      <GlassPanel className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-skeleton h-12" />
        ))}
      </GlassPanel>
    </div>
  );
}
