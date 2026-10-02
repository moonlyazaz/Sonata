import { X, Trash2, Play, Pause } from 'lucide-react';
import { GlassPanel } from '@/components/glass';
import { bigArtwork } from '@/lib/soundcloud';
import { usePlayerStore } from '@/stores/playerStore';

/** Painel lateral com a fila e o "tocando agora". */
export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const contextLabel = usePlayerStore((s) => s.contextLabel);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const jumpTo = usePlayerStore((s) => s.jumpTo);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearUpcoming = usePlayerStore((s) => s.clearUpcoming);

  const current = queue[index];
  const upcoming = queue.slice(index + 1);

  return (
    <GlassPanel className="flex h-full flex-col" scroll>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Fila</h2>
          {contextLabel && (
            <p className="text-faint truncate text-xs">de “{contextLabel}”</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {upcoming.length > 0 && (
            <button
              className="text-faint hover:text flex items-center gap-1 text-xs transition"
              onClick={clearUpcoming}
            >
              <Trash2 size={13} /> Limpar
            </button>
          )}
          <button
            className="glass-icon-btn !h-7 !w-7"
            onClick={() => setQueueOpen(false)}
            aria-label="Fechar fila"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-3">
        {/* Tocando agora */}
        {current && (
          <section>
            <h3 className="text-faint mb-2 px-1 text-[11px] font-semibold tracking-wider uppercase">
              Tocando agora
            </h3>
            <div className="flex items-center gap-3 rounded-xl bg-white/8 p-2">
              <button
                className="relative shrink-0"
                onClick={() => void togglePlay()}
                aria-label={isPlaying ? 'Pausar' : 'Tocar'}
              >
                {/* Sem `artwork_url` (comum) → avatar do artista, igual à barra */}
                {current.artwork_url || current.user.avatar_url ? (
                  <img
                    src={
                      bigArtwork(current.artwork_url, 'large') ??
                      current.user.avatar_url ??
                      undefined
                    }
                    alt=""
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-white/10" />
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition hover:opacity-100">
                  {isPlaying ? (
                    <Pause size={16} fill="#fff" color="#fff" />
                  ) : (
                    <Play size={16} fill="#fff" color="#fff" />
                  )}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-accent truncate text-sm font-semibold">{current.title}</p>
                <p className="text-muted truncate text-xs">{current.user.username}</p>
              </div>
            </div>
          </section>
        )}

        {/* Próximas */}
        <section>
          <h3 className="text-faint mb-2 px-1 text-[11px] font-semibold tracking-wider uppercase">
            A seguir
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-faint px-1 py-3 text-xs">
              Fila vazia — adicione músicas de qualquer lista.
            </p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((t, i) => {
                const absolute = index + 1 + i;
                return (
                  <li
                    key={`${t.id}-${absolute}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
                  >
                    <button
                      className="relative shrink-0"
                      onClick={() => void jumpTo(absolute)}
                      aria-label={`Tocar ${t.title}`}
                    >
                      {/* Mesmo fallback do "tocando agora" */}
                      {t.artwork_url || t.user.avatar_url ? (
                        <img
                          src={
                            bigArtwork(t.artwork_url, 'large') ??
                            t.user.avatar_url ??
                            undefined
                          }
                          alt=""
                          className="h-9 w-9 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-white/10" />
                      )}
                      <span className="absolute inset-0 hidden items-center justify-center rounded bg-black/40 group-hover:flex">
                        <Play size={13} fill="#fff" color="#fff" />
                      </span>
                    </button>

                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void jumpTo(absolute)}
                    >
                      <p className="truncate text-xs font-medium">{t.title}</p>
                      <p className="text-faint truncate text-[11px]">{t.user.username}</p>
                    </button>

                    <button
                      className="glass-icon-btn !h-7 !w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => removeFromQueue(absolute)}
                      aria-label={`Remover ${t.title} da fila`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </GlassPanel>
  );
}
