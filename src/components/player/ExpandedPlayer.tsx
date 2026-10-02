import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Disc3,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { bigArtwork } from '@/lib/soundcloud';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Player em tela cheia — o "menu expansível" da barra inferior.
 *
 * É o lugar onde o play/pause é grande e óbvio: clicar na capa ou no ⤢ da
 * barra abre isto. Fecha com Esc (atalho global), clicando fora, ou no ⌄.
 *
 * O foco NÃO é movido para nenhum botão de propósito: com um botão focado,
 * a tecla Space acionaria o botão em vez do atalho global de play/pause.
 */
export function ExpandedPlayer() {
  const expanded = usePlayerStore((s) => s.expanded);
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
  const contextLabel = usePlayerStore((s) => s.contextLabel);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setExpanded = usePlayerStore((s) => s.setExpanded);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);

  const navigate = useNavigate();
  const track = queue[index];
  const isLiked = useLibraryStore((s) => (track ? s.likedIds.includes(track.id) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const close = () => setExpanded(false);
  // A fila abre POR CIMA disto, então fecha o expandido junto
  const openQueue = () => {
    setExpanded(false);
    setQueueOpen(true);
  };

  return (
    <AnimatePresence>
      {expanded && track && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col p-2 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
          role="dialog"
          aria-modal="true"
          aria-label="Player expandido"
          style={{
            background: 'rgba(3, 3, 5, 0.74)',
            backdropFilter: 'blur(30px) saturate(140%)',
            WebkitBackdropFilter: 'blur(30px) saturate(140%)',
          }}
        >
          <motion.div
            className="glass-liquid glass-liquid--sheet mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden"
            initial={{ y: 40, scale: 0.975, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* -------- topo: fechar / origem / fila -------- */}
            <div className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-5">
              <button
                className="glass-icon-btn shrink-0"
                onClick={close}
                aria-label="Fechar player expandido"
                title="Fechar (Esc)"
              >
                <ChevronDown size={24} />
              </button>

              <div className="min-w-0 text-center">
                <p className="text-faint text-[10px] font-semibold tracking-[0.2em] uppercase">
                  Tocando de
                </p>
                <p className="truncate text-sm font-semibold">
                  {contextLabel || 'Fila de reprodução'}
                </p>
              </div>

              <button
                className={`glass-icon-btn shrink-0 ${queueOpen ? 'is-active' : ''}`}
                onClick={openQueue}
                aria-label="Fila de reprodução"
                aria-pressed={queueOpen}
                title="Fila"
              >
                <ListMusic size={22} />
              </button>
            </div>

            {/* -------- conteúdo (rola se não couber) -------- */}
            <div className="glass-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col items-center justify-center gap-5 px-4 py-5 sm:gap-7">
                {/* capa */}
                <motion.div
                  key={track.id}
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="shrink-0"
                >
                  {artwork(track) ? (
                    <img
                      src={artwork(track)}
                      alt=""
                      className="aspect-square rounded-3xl object-cover shadow-[0_30px_90px_rgba(0,0,0,0.65)] ring-1 ring-white/25"
                      style={{ width: 'min(62vw, 340px)' }}
                    />
                  ) : (
                    <div
                      className="flex aspect-square items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/20"
                      style={{ width: 'min(62vw, 340px)' }}
                    >
                      <Disc3 size={72} className="text-white/40" />
                    </div>
                  )}
                </motion.div>

                {/* título + artista */}
                <div className="w-full max-w-2xl text-center">
                  <h2 className="truncate text-2xl font-bold sm:text-3xl">{track.title}</h2>
                  <button
                    className="text-muted mt-1 text-sm hover:text hover:underline"
                    onClick={() => {
                      close();
                      navigate(`/artist/${track.user.id}`);
                    }}
                  >
                    {track.user.username}
                  </button>
                </div>

                {/* progresso */}
                <div className="w-full max-w-2xl">
                  <SeekBar
                    current={currentTime}
                    duration={duration}
                    onSeek={seek}
                    disabled={!track}
                  />
                </div>

                {/* transporte */}
                <div className="flex w-full max-w-2xl items-center justify-center gap-4 sm:gap-7">
                  <button
                    className={`glass-icon-btn !h-11 !w-11 ${shuffle ? 'is-active' : ''}`}
                    onClick={toggleShuffle}
                    aria-label="Ordem aleatória"
                    aria-pressed={shuffle}
                    title="Aleatório"
                  >
                    <Shuffle size={22} />
                  </button>

                  <button
                    className="glass-icon-btn !h-12 !w-12"
                    onClick={() => void prev()}
                    aria-label="Faixa anterior"
                    title="Anterior"
                  >
                    <SkipBack size={28} fill="currentColor" />
                  </button>

                  <button
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_40px_rgba(0,0,0,0.55)] transition hover:scale-105 active:scale-95 sm:h-[72px] sm:w-[72px]"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? 'Pausar' : 'Tocar'}
                    title={isPlaying ? 'Pausar' : 'Tocar'}
                  >
                    {isLoading ? (
                      <Loader2 size={30} className="animate-spin" />
                    ) : isPlaying ? (
                      <Pause size={30} fill="currentColor" />
                    ) : (
                      <Play size={30} fill="currentColor" className="ml-1" />
                    )}
                  </button>

                  <button
                    className="glass-icon-btn !h-12 !w-12"
                    onClick={() => void next()}
                    aria-label="Próxima faixa"
                    title="Próxima"
                  >
                    <SkipForward size={28} fill="currentColor" />
                  </button>

                  <button
                    className={`glass-icon-btn !h-11 !w-11 ${repeat !== 'off' ? 'is-active' : ''}`}
                    onClick={cycleRepeat}
                    aria-label={`Repetição: ${repeat === 'off' ? 'desligada' : repeat === 'all' ? 'fila' : 'faixa'}`}
                    title={
                      repeat === 'off'
                        ? 'Sem repetição'
                        : repeat === 'all'
                          ? 'Repetir fila'
                          : 'Repetir faixa'
                    }
                  >
                    {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
                  </button>
                </div>

                {/* curtir + volume */}
                <div className="flex w-full max-w-2xl items-center justify-between gap-4">
                  <button
                    className={`glass-icon-btn ${isLiked ? 'is-active' : ''}`}
                    onClick={() => toggleLike(track)}
                    aria-label={isLiked ? 'Remover das curtidas' : 'Adicionar às curtidas'}
                    aria-pressed={isLiked}
                    title={isLiked ? 'Remover das curtidas' : 'Adicionar às curtidas'}
                  >
                    <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
                  </button>

                  <VolumeControl
                    volume={volume}
                    muted={muted}
                    onChange={setVolume}
                    onToggleMute={toggleMute}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Capa grande, com o avatar como fallback. */
function artwork(track: {
  artwork_url?: string | null;
  user?: { avatar_url?: string | null };
}): string | undefined {
  return bigArtwork(track.artwork_url, 't500x500') ?? track.user?.avatar_url ?? undefined;
}
