import { FolderPlus, Heart, ListPlus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { ativarEqBars } from '@/lib/audio';
import { formatDuration } from '@/lib/format';
import { bigArtwork, type ScTrack } from '@/lib/soundcloud';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';
import { usePlaylistMenuStore } from '@/stores/playlistMenuStore';

interface TrackRowProps {
  track: ScTrack;
  index?: number;
  /** Toca a faixa — plugado pelo player na Fase 2 */
  onPlay?: (track: ScTrack) => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  /** mostra o link para o perfil do artista */
  showArtistLink?: boolean;
  onArtistClick?: (artistId: number) => void;
  /** contexto usado ao adicionar na biblioteca recente */
  recordRecent?: boolean;
  /** origem da lista — vira o cabeçalho da fila se o enfileirar iniciar a tocar */
  contextLabel?: string;
  /** Remove a faixa da coleção atual (playlist do usuário). */
  onRemove?: () => void;
}

/**
 * Linha de música — a unidade básica das listas.
 * Nível: número, capa, título/artista, curtir, duração.
 */
export function TrackRow({
  track,
  index,
  onPlay,
  isCurrent = false,
  isPlaying = false,
  onArtistClick,
  recordRecent = true,
  contextLabel,
  onRemove,
}: TrackRowProps) {
  const isLiked = useLibraryStore((s) => s.likedIds.includes(track.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const pushRecent = useLibraryStore((s) => s.pushRecent);
  const enqueue = usePlayerStore((s) => s.enqueue);
  const openPlaylistMenu = usePlaylistMenuStore((s) => s.open);

  const art = bigArtwork(track.artwork_url, 'badge') ?? track.user.avatar_url;
  const active = isCurrent && isPlaying;

  /**
   * Clique na linha: se já é a faixa atual, alterna play/pause;
   * senão, começa a lista por ela. Assim o ⏸ aparece no próprio item.
   */
  const handlePlay = () => {
    if (isCurrent) {
      void usePlayerStore.getState().togglePlay();
      return;
    }
    if (recordRecent) pushRecent(track);
    onPlay?.(track);
  };

  const playLabel = active ? `Pausar ${track.title}` : `Tocar ${track.title}`;

  return (
    <li
      className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition md:gap-4 ${
        isCurrent ? 'bg-white/8' : 'hover:bg-white/5'
      }`}
    >
      {index !== undefined && (
        /* Só o número. Antes o hover trocava por um ▶/⏸ — mas clicar no título
           já chama `handlePlay`, então o botão não acrescentava nada e sumia
           com a posição da faixa. */
        <span
          className={`w-5 shrink-0 text-right text-sm tabular-nums ${
            isCurrent ? 'text-accent' : 'text-faint'
          }`}
        >
          {active ? <EqBars /> : index}
        </span>
      )}

      {art && (
        <img
          src={art}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      )}

      <div className="min-w-0 flex-1">
        <button
          className={`block w-full truncate text-left text-sm font-medium hover:underline ${
            isCurrent ? 'text-accent' : ''
          }`}
          onClick={handlePlay}
          aria-label={playLabel}
          title={active ? 'Pausar' : 'Tocar'}
        >
          {track.title}
        </button>
        <button
          className="text-muted hover:text underline-offset-2 truncate text-xs hover:underline"
          onClick={() => onArtistClick?.(track.user.id)}
        >
          {track.user.username}
        </button>
      </div>

      <button
        className={`glass-icon-btn !h-8 !w-8 transition-opacity ${
          isLiked
            ? 'text-accent opacity-100'
            : // Sem hover no toque: no mobile o coração fica sempre visível —
              // antes só os já curtidos apareciam, e o resto era um vazio de 32px.
              'opacity-0 max-md:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
        onClick={() => toggleLike(track)}
        aria-label={isLiked ? 'Remover das curtidas' : 'Adicionar às curtidas'}
        aria-pressed={isLiked}
      >
        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
      </button>

      <span className="text-faint w-12 text-right text-xs tabular-nums">
        {formatDuration(track.duration / 1000)}
      </span>

      {/* Só desktop: no toque não existe hover, então o botão ficava invisível
          mas ainda ocupando 32px — junto com o de playlist, era 64px roubados
          do nome da faixa. */}
      <button
        className="glass-icon-btn hidden !h-8 !w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 md:inline-flex"
        onClick={() => enqueue(track, 'end', contextLabel)}
        aria-label={`Adicionar ${track.title} à fila`}
        title="Adicionar à fila"
      >
        <ListPlus size={16} />
      </button>

      {onRemove ? (
        <button
          className="glass-icon-btn !h-8 !w-8 text-red-400/80 opacity-0 max-md:opacity-100 transition group-hover:opacity-100 hover:text-red-400 focus-visible:opacity-100"
          onClick={onRemove}
          aria-label={`Remover ${track.title} da playlist`}
          title="Remover da playlist"
        >
          <Trash2 size={16} />
        </button>
      ) : (
        <button
          className="glass-icon-btn !h-8 !w-8 opacity-0 max-md:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => openPlaylistMenu(track)}
          aria-label={`Adicionar ${track.title} à playlist`}
          title="Adicionar à playlist"
        >
          <FolderPlus size={16} />
        </button>
      )}
    </li>
  );
}

/**
 * Barrinhas indicando que a faixa está tocando.
 *
 * Enquanto existe um `EqBars` montado na página, o loop compartilhado de
 * `lib/audio.ts` escreve `--eq-1/2/3` no `<html>` e as alturas passam a vir
 * da FFT real. No desmount o loop morre e volta a animação CSS — que é o que
 * aparece antes de qualquer toque, quando o grafo ainda nem existe.
 */
function EqBars() {
  useEffect(() => ativarEqBars(), []);

  return (
    <span className="eq-bars" aria-label="Tocando">
      <span />
      <span />
      <span />
    </span>
  );
}
