import { Loader2, ListMusic, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Heart } from 'lucide-react';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { bigArtwork } from '@/lib/soundcloud';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Barra fixa inferior do player.
 * Layout: [faixa atual] [transporte + seek] [volume / fila / expandir]
 */
export function PlayerBar() {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const error = usePlayerStore((s) => s.error);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const setExpanded = usePlayerStore((s) => s.setExpanded);

  const track = queue[index];
  const isLiked = useLibraryStore((s) => (track ? s.likedIds.includes(track.id) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  // Sem faixa → barra ociosa (mantém a altura para não saltar o layout)
  const hasTrack = Boolean(track);

  return (
    <footer
      className="glass-liquid glass-liquid--bar fixed right-0 bottom-0 left-0 z-40 flex h-[var(--player-h)] items-center gap-4 px-4"
      role="contentinfo"
      aria-label="Player"
    >
      {/* -------- Faixa atual -------- */}
      <div className="flex w-[30%] min-w-0 items-center gap-3">
        {hasTrack ? (
          <>
            <button
              className="relative shrink-0"
              onClick={() => setExpanded(true)}
              aria-label="Expandir player"
            >
              {/* Muitas faixas do SoundCloud vêm sem `artwork_url` — nesse caso
                  usamos o avatar do artista (como o player expandido já fazia),
                  senão a mini barra virava uma caixa cinza vazia. */}
              {track.artwork_url || track.user.avatar_url ? (
                <img
                  src={
                    bigArtwork(track.artwork_url, 'large') ??
                    track.user.avatar_url ??
                    undefined
                  }
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover shadow-lg"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-white/10" />
              )}
            </button>

            <div className="min-w-0">
              <button
                className="block w-full truncate text-left text-sm font-semibold hover:underline"
                onClick={() => setExpanded(true)}
              >
                {track.title}
              </button>
              <button
                className="text-muted block w-full truncate text-left text-xs hover:underline"
                onClick={() => track && usePlayerStore.getState().setQueueOpen(true)}
              >
                {track.user.username}
              </button>
            </div>

            <button
              className={`glass-icon-btn !h-8 !w-8 shrink-0 ${isLiked ? 'is-active' : ''}`}
              onClick={() => toggleLike(track)}
              aria-label={isLiked ? 'Remover das curtidas' : 'Adicionar às curtidas'}
              aria-pressed={isLiked}
            >
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </>
        ) : (
          <p className="text-faint text-sm">Nada tocando</p>
        )}
      </div>

      {/* -------- Transporte + progresso -------- */}
      <div className="flex w-[40%] max-w-[720px] min-w-0 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <button
            className={`glass-icon-btn !h-8 !w-8 ${shuffle ? 'is-active' : ''}`}
            onClick={toggleShuffle}
            aria-label="Ordem aleatória"
            aria-pressed={shuffle}
            title="Aleatório"
          >
            <Shuffle size={17} />
          </button>

          <button
            className="glass-icon-btn !h-8 !w-8"
            onClick={() => void prev()}
            aria-label="Faixa anterior"
            disabled={!hasTrack}
            title="Anterior"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 disabled:opacity-40"
            onClick={() => void togglePlay()}
            disabled={!hasTrack}
            aria-label={isPlaying ? 'Pausar' : 'Tocar'}
            title={isPlaying ? 'Pausar' : 'Tocar'}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            className="glass-icon-btn !h-8 !w-8"
            onClick={() => void next()}
            aria-label="Próxima faixa"
            disabled={!hasTrack}
            title="Próxima"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          <button
            className={`glass-icon-btn !h-8 !w-8 ${repeat !== 'off' ? 'is-active' : ''}`}
            onClick={cycleRepeat}
            aria-label={`Repetição: ${repeat === 'off' ? 'desligada' : repeat === 'all' ? 'fila' : 'faixa'}`}
            title={repeat === 'off' ? 'Sem repetição' : repeat === 'all' ? 'Repetir fila' : 'Repetir faixa'}
          >
            {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </button>
        </div>

        <SeekBar
          current={currentTime}
          duration={duration}
          onSeek={seek}
          disabled={!hasTrack}
        />

        {error && (
          <p className="text-xs" style={{ color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        )}
      </div>

      {/* -------- Volume / fila -------- */}
      <div className="flex w-[30%] items-center justify-end gap-1">
        <button
          className={`glass-icon-btn !h-8 !w-8 ${queueOpen ? 'is-active' : ''}`}
          onClick={() => setQueueOpen(!queueOpen)}
          aria-label="Fila de reprodução"
          aria-pressed={queueOpen}
          title="Fila"
        >
          <ListMusic size={18} />
        </button>

        <VolumeControl
          volume={volume}
          muted={muted}
          onChange={setVolume}
          onToggleMute={toggleMute}
        />

        <button
          className="glass-icon-btn hidden !h-8 !w-8 md:inline-flex"
          onClick={() => setExpanded(true)}
          aria-label="Tela cheia"
          title="Tela cheia"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </footer>
  );
}
