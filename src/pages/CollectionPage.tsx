import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Disc3, Heart, ListPlus, Play, Shuffle } from 'lucide-react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { TrackRow } from '@/components/music/TrackRow';
import { useCollection } from '@/hooks/useCollection';
import { usePlayList } from '@/hooks/usePlayList';
import { usePlayerStore } from '@/stores/playerStore';
import { bigArtwork } from '@/lib/soundcloud';
import { formatDuration, hueFromId } from '@/lib/format';

/**
 * Página de playlist **e** de álbum.
 *
 * No SoundCloud as duas são a mesma entidade (`is_album` distingue), então
 * `/album/:id` e `/playlist/:id` compartilham este componente.
 */
export function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { playlist, tracks, loading, error } = useCollection(id);

  const title = playlist?.title ?? '';
  const playList = usePlayList(title);
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueMany = usePlayerStore((s) => s.enqueueMany);

  // Rota /album força album; depois disso vale o is_album vindo da API.
  const isAlbum = playlist ? playlist.is_album === true : location.pathname.startsWith('/album');

  const totalSec = useMemo(
    () => tracks.reduce((acc, t) => acc + t.duration / 1000, 0),
    [tracks],
  );

  if (loading) return <CollectionSkeleton />;

  if (error || !playlist) {
    return (
      <GlassPanel className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-lg font-semibold">Não foi possível carregar</p>
        <p className="text-faint max-w-md text-sm">{error ?? 'Conteúdo indisponível.'}</p>
        <GlassButton onClick={() => navigate(-1)}>Voltar</GlassButton>
      </GlassPanel>
    );
  }

  const label = playlist.title;
  const artworkUrl = bigArtwork(playlist.artwork_url, 't500x500');
  const owner = playlist.user;
  const year = playlist.release_date?.slice(0, 4);

  const playAll = () => {
    if (tracks.length > 0) void playTrack(tracks[0], tracks, label);
  };

  const playShuffled = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    void playTrack(shuffled[0], shuffled, label);
  };

  return (
    <div className="space-y-6 py-6">
      {/* ---------------- cabeçalho ---------------- */}
      <header
        className="glass-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-6"
        style={{
          background: `linear-gradient(135deg, hsla(${hueFromId(playlist.id)}, 70%, 45%, .55), rgba(56,189,248,.25))`,
        }}
      >
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            className="h-40 w-40 shrink-0 rounded-xl object-cover shadow-2xl sm:h-48 sm:w-48"
          />
        ) : (
          <div
            className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl shadow-2xl sm:h-48 sm:w-48"
            style={{ background: 'rgba(0,0,0,.35)' }}
          >
            <Disc3 size={64} className="text-white/50" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80">
            {isAlbum ? 'Álbum' : 'Playlist'}
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-bold break-words sm:text-5xl">
            {playlist.title}
          </h1>

          {playlist.description && (
            <p className="text-muted mt-3 max-w-2xl text-sm leading-relaxed">
              {playlist.description}
            </p>
          )}

          <p className="text-muted mt-3 text-sm">
            {owner && (
              <button
                className="font-semibold text-white hover:underline"
                onClick={() => owner.id && navigate(`/artist/${owner.id}`)}
              >
                {owner.full_name || owner.username}
              </button>
            )}
            {year && <> · {year}</>}
            {' · '}
            {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
            {' · '}
            {formatDuration(totalSec)}
            {typeof playlist.likes_count === 'number' && playlist.likes_count > 0 && (
              <>
                {' · '}
                {playlist.likes_count} curtidas
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <GlassButton variant="accent" size="lg" onClick={playAll} disabled={tracks.length === 0}>
            <Play size={18} fill="currentColor" /> Tocar
          </GlassButton>
          <GlassButton size="lg" onClick={playShuffled} disabled={tracks.length === 0}>
            <Shuffle size={18} /> Aleatório
          </GlassButton>
          <GlassButton size="lg" onClick={() => enqueueMany(tracks, title)} disabled={tracks.length === 0}>
            <ListPlus size={18} /> Fila
          </GlassButton>
        </div>
      </header>

      {/* ---------------- faixas ---------------- */}
      <GlassPanel className="p-2">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Heart size={32} className="text-faint" />
            <p className="text-sm font-semibold">Nenhuma faixa aqui</p>
            <p className="text-faint max-w-sm text-xs">
              Esta {isAlbum ? 'álbum' : 'playlist'} não tem faixas públicas.
            </p>
          </div>
        ) : (
          <>
            <div className="text-faint flex items-center gap-4 border-b border-white/10 px-3 py-2 text-[11px] font-semibold tracking-wider uppercase">
              <span className="w-5 text-right">#</span>
              <span className="flex-1">Título</span>
              <span className="w-12 text-right">Duração</span>
              <span className="w-8" aria-hidden />
            </div>
            <ul>
              {tracks.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i + 1}
                  isCurrent={currentId === t.id}
                  isPlaying={isPlaying}
                  contextLabel={label}
                  onPlay={(track) => playList(track, tracks, label)}
                  onArtistClick={(artistId) => navigate(`/artist/${artistId}`)}
                />
              ))}
            </ul>
          </>
        )}
      </GlassPanel>
    </div>
  );
}

/** Esqueleto do cabeçalho + linhas, enquanto carrega. */
function CollectionSkeleton() {
  return (
    <div className="space-y-6 py-6">
      <div className="glass-panel flex flex-col gap-5 p-6 sm:flex-row sm:items-end">
        <div className="glass-skeleton h-40 w-40 shrink-0 sm:h-48 sm:w-48" />
        <div className="flex-1 space-y-3">
          <div className="glass-skeleton h-3 w-20" />
          <div className="glass-skeleton h-10 w-3/4" />
          <div className="glass-skeleton h-3 w-1/2" />
        </div>
      </div>
      <GlassPanel className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-skeleton h-12" />
        ))}
      </GlassPanel>
    </div>
  );
}
