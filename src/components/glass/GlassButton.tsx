import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

/** Botão de vidro. `variant="accent"` usa o azul claro da marca. */
export function GlassButton({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...rest
}: GlassButtonProps) {
  return (
    <button
      className={`glass-btn ${variant === 'accent' ? 'glass-btn--accent' : ''} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
