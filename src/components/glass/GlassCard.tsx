import type { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Cartão de vidro base — hover eleva e brilha. */
export function GlassCard({ children, className = '', ...rest }: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`} {...rest}>
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
