import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Modal de vidro com backdrop desfocado, fecha no Esc e no clique externo. */
export function GlassModal({ open, onClose, title, children, className = '' }: GlassModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <GlassPanel className={`w-full max-w-lg p-6 ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          {title ? <h2 className="text-xl font-bold">{title}</h2> : <span />}
          <button className="glass-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </GlassPanel>
    </div>
  );
}
