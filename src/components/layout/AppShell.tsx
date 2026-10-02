import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PlayerBar } from '@/components/player/PlayerBar';
import { QueuePanel } from '@/components/player/QueuePanel';
import { ExpandedPlayer } from '@/components/player/ExpandedPlayer';
import { AddToPlaylistMenu } from '@/components/playlist/AddToPlaylistMenu';
import { PlaylistDialog } from '@/components/playlist/PlaylistDialog';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { startPlayer, usePlayerStore } from '@/stores/playerStore';

/**
 * Casca do app:
 * [fundo animado]
 * [sidebar] [ topbar
 *            conteúdo (rota)     ] [fila?]
 * [     player bar fixa — só quando há faixa      ]
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  // Existe barra só quando há faixa — e o espaço dela no rodapé do conteúdo
  // aparece junto, senão o scroll saltaria de altura de um pro outro.
  const hasTrack = usePlayerStore((s) => Boolean(s.queue[s.index]));

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  // Liga o elemento de áudio à store + atalhos (idempotente)
  useEffect(() => {
    startPlayer();
  }, []);
  useKeyboardShortcuts();

  return (
    <>
      {/* Fundo: blobs de gradiente desfocados atrás do vidro */}
      <div className="app-bg" aria-hidden>
        <div className="app-bg__blob app-bg__blob--1" />
        <div className="app-bg__blob app-bg__blob--2" />
        <div className="app-bg__blob app-bg__blob--3" />
      </div>

      <div className="relative z-10 flex h-full gap-2 p-2 pb-0">
        {!isMobile && <Sidebar open={false} onClose={closeMenu} />}
        {isMobile && <Sidebar open={menuOpen} onClose={closeMenu} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={openMenu} />

          <main
            className={`glass-scroll min-h-0 flex-1 overflow-y-auto pt-2 pr-1 transition-[padding-bottom] duration-300 ${
              hasTrack ? 'pb-[calc(var(--player-h)+16px)]' : 'pb-4'
            }`}
          >
            <div className="mx-auto w-full max-w-7xl px-2 sm:px-4">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Fila: painel direito no desktop, overlay nas telas estreitas */}
        {queueOpen && !isTablet && (
          <aside className="hidden w-[var(--rightpanel-w)] shrink-0 lg:block">
            <QueuePanel />
          </aside>
        )}
        {queueOpen && isTablet && <QueueOverlay onClose={() => usePlayerStore.getState().setQueueOpen(false)} />}
      </div>

      <AnimatePresence>{hasTrack && <PlayerBar key="player" />}</AnimatePresence>
      <ExpandedPlayer />
      {/* modal único de "adicionar à playlist", aberto por qualquer TrackRow */}
      <AddToPlaylistMenu />
      {/* host do modal de playlist — precisa ficar fora de painéis com filtro */}
      <PlaylistDialog />
    </>
  );
}

/** Fila em tela cheia para mobile/tablet. */
function QueueOverlay({ onClose }: { onClose: () => void }) {
  // Esc fecha — mesmo comportamento do painel lateral
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col p-3"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(10px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-label="Fila de reprodução"
    >
      <div className="min-h-0 flex-1">
        <QueuePanel />
      </div>
    </div>
  );
}
