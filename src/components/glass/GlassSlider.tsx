import { useCallback, useRef } from 'react';

interface GlassSliderProps {
  /** 0..1 */
  value: number;
  onChange: (value: number) => void;
  /** chamado ao soltar — bom para seek de áudio */
  onCommit?: (value: number) => void;
  ariaLabel: string;
  className?: string;
}

/** Slider de vidro acessível (mouse, toque e teclado). */
export function GlassSlider({ value, onChange, onCommit, ariaLabel, className = '' }: GlassSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const valueFromEvent = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(valueFromEvent(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    onChange(valueFromEvent(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit?.(valueFromEvent(e.clientX));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(1, value + step);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, value - step);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = 1;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    onCommit?.(next);
  };

  const pct = `${Math.round(value * 100)}%`;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={`glass-slider ${className}`}
      style={{ ['--value' as string]: pct }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="glass-slider__track">
        <div className="glass-slider__fill" />
      </div>
      <div className="glass-slider__thumb" />
    </div>
  );
}
