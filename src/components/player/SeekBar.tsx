import { useEffect, useRef, useState } from 'react';
import { GlassSlider } from '@/components/glass';

interface SeekBarProps {
  /** segundos */
  current: number;
  duration: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Barra de progresso com tempo decorrido/restante.
 *
 * Enquanto o usuário arrasta, mostra a posição alvo local (`preview`) em vez
 * da posição real: sem isso os `timeupdate` chegam durante o arrasto e o
 * thumb "pula" de volta para onde a música está.
 */
export function SeekBar({ current, duration, onSeek, disabled, ariaLabel = 'Progresso' }: SeekBarProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const draggingRef = useRef(false);

  // Solta o arrasto mesmo quando o ponteiro sai da janela
  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setPreview(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const shown = preview ?? (duration > 0 ? current : 0);
  const ratio = duration > 0 ? Math.min(1, shown / duration) : 0;

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <span className="text-faint w-10 shrink-0 text-right text-[11px] tabular-nums">
        {format(shown)}
      </span>
      <GlassSlider
        value={disabled ? 0 : ratio}
        onChange={(v) => {
          // só pré-visualiza: o seek de verdade acontece no commit,
          // evitando um evento de seek a cada pixel arrastado
          draggingRef.current = true;
          if (duration > 0) setPreview(v * duration);
        }}
        onCommit={(v) => {
          draggingRef.current = false;
          setPreview(null);
          if (duration > 0) onSeek(v * duration);
        }}
        ariaLabel={ariaLabel}
        className={disabled ? 'pointer-events-none opacity-40' : ''}
      />
      <span className="text-faint w-10 shrink-0 text-[11px] tabular-nums">
        {format(duration)}
      </span>
    </div>
  );
}

function format(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
