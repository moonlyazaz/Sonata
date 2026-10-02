import { Music2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface PlaceholderProps {
  title: string;
  icon: ReactNode;
  description: string;
}

function Placeholder({ title, icon, description }: PlaceholderProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div
        className="glass-panel flex h-20 w-20 items-center justify-center"
        style={{ borderRadius: 'var(--radius-xl)' }}
      >
        <span className="relative z-10 text-accent">{icon}</span>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">{description}</p>
      <span className="glass-chip">Em breve</span>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <Placeholder
      title="Página não encontrada"
      icon={<Music2 size={34} />}
      description="O endereço que você abriu não existe neste clone."
    />
  );
}
