import type { HTMLAttributes, ReactNode } from 'react';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Classe extra para o container de scroll interno */
  scroll?: boolean;
}

/** Painel de vidro grosso — usado em sidebar, painel direito e modais. */
export function GlassPanel({ children, scroll = false, className = '', ...rest }: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${scroll ? 'glass-scroll overflow-y-auto' : ''} ${className}`}
      {...rest}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
