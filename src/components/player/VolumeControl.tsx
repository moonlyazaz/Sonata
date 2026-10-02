import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { GlassSlider } from '@/components/glass';

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onChange: (v: number) => void;
  onToggleMute: () => void;
}

/** Controle de volume com botão de mudo. */
export function VolumeControl({ volume, muted, onChange, onToggleMute }: VolumeControlProps) {
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-32 items-center gap-2">
      <button
        className={`glass-icon-btn !h-8 !w-8 shrink-0 ${muted ? 'is-active' : ''}`}
        onClick={onToggleMute}
        aria-label={muted ? 'Ativar som' : 'Silenciar'}
      >
        <Icon size={18} />
      </button>
      <GlassSlider
        value={effective}
        onChange={onChange}
        ariaLabel="Volume"
      />
    </div>
  );
}
