import { Play } from 'lucide-react';
import { GlassCard } from '@/components/glass';
import { bigArtwork } from '@/lib/soundcloud';

interface MediaCardProps {
  image: string | null;
  title: string;
  subtitle: string;
  /** forma do container: quadrada (playlist/artista) ou circular (artista) */
  shape?: 'square' | 'circle';
  onClick?: () => void;
  onPlay?: () => void;
}

/** Card de conteúdo com capa, título e subtítulo. */
export function MediaCard({
  image,
  title,
  subtitle,
  shape = 'square',
  onClick,
  onPlay,
}: MediaCardProps) {
  return (
    <GlassCard className="group cursor-pointer p-3" onClick={onClick}>
      <div
        className={`relative mb-3 overflow-hidden bg-white/10 ${
          shape === 'circle' ? 'aspect-square rounded-full' : 'aspect-square rounded-xl'
        }`}
      >
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
        {onPlay && (
          <button
            className="absolute right-2 bottom-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:opacity-0"
            style={{ background: 'var(--accent)' }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            aria-label={`Tocar ${title}`}
          >
            <Play size={17} fill="#04121d" color="#04121d" />
          </button>
        )}
      </div>
      <p className="truncate text-sm font-semibold">{title}</p>
      <p className="text-faint mt-0.5 truncate text-xs">{subtitle}</p>
    </GlassCard>
  );
}

/** Converte artwork do SoundCloud para um URL maior. */
export const artwork = (url: string | null | undefined) => bigArtwork(url, 't500x500');
