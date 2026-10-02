import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Library, Heart, Plus, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlaylistDialogStore } from '@/stores/playlistDialogStore';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const mainNav = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/library', label: 'Sua Biblioteca', icon: Library },
];

/** Sidebar de vidro: navegação principal + listas do usuário. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);
  const playlists = useLibraryStore((s) => s.playlists);
  const likedCount = useLibraryStore((s) => s.likedIds.length);
  const showPlaylistDialog = usePlaylistDialogStore((s) => s.show);
  const location = useLocation();

  // Fecha o drawer ao trocar de rota (mobile)
  const routeKey = location.pathname;
  useEffect(() => {
    if (isMobile) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const collapsed = isTablet && !isMobile;

  const content = (
    <nav className="flex h-full flex-col gap-2 p-3" aria-label="Navegação principal">
      <div className="mb-3 flex items-center justify-between px-2">
        {!collapsed && (
          <span className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.02em]">
            <Logo size={30} />
            <span className="sonata-word">Sonata</span>
          </span>
        )}
        {isMobile && (
          <button className="glass-icon-btn" onClick={onClose} aria-label="Fechar menu">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {mainNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
            title={label}
          >
            <Icon size={20} strokeWidth={2.2} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="my-3 h-px bg-white/10" />

      <div className="space-y-1">
        <NavLink
          to="/liked"
          onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
          title="Curtidas"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm"
            style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)' }}
          >
            <Heart size={16} fill="currentColor" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate">Curtidas</span>
              <span className="text-faint block text-xs font-normal">
                {likedCount} {likedCount === 1 ? 'música' : 'músicas'}
              </span>
            </span>
          )}
        </NavLink>
      </div>

      {/* Sempre visível: o "+" de criar precisa existir justamente quando
          a lista de playlists ainda está vazia. */}
      {!collapsed && (
        <>
          <div className="my-3 h-px bg-white/10" />
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-faint text-xs font-semibold tracking-wider uppercase">
              Playlists
            </p>
            <button
              className="text-faint hover:text transition"
              onClick={() => showPlaylistDialog()}
              aria-label="Criar nova playlist"
              title="Nova playlist"
            >
              <Plus size={15} />
            </button>
          </div>

          {playlists.length > 0 ? (
            <ul className="glass-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {playlists.map((p) => (
                <li key={p.id}>
                  <NavLink
                    to={`/playlist/${p.id}`}
                    onClick={onClose}
                    className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <div className="min-h-0 flex-1" />
          )}
        </>
      )}
    </nav>
  );

  // Mobile: drawer sobreposto
  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={onClose}
          aria-hidden
        />
        <aside
          className={`glass-panel fixed top-3 bottom-3 left-3 z-50 w-72 transition-transform duration-300 ${
            open ? 'translate-x-0' : '-translate-x-[110%]'
          }`}
          style={{ backdropFilter: 'var(--blur-thick)' }}
        >
          <div className="relative z-10 h-full">{content}</div>
        </aside>
      </>
    );
  }

  // Desktop/tablet: coluna fixa
  return (
    <aside
      className={`glass-panel h-full shrink-0 ${collapsed ? 'w-[84px]' : 'w-[var(--sidebar-w)]'}`}
    >
      {content}
    </aside>
  );
}
