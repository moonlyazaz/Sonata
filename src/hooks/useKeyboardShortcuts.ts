import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Atalhos globais de teclado do player.
 *
 *  Space        → tocar/pausar
 *  ← / →        → ±10s
 *  Shift+← / →  → faixa anterior/próxima
 *  M            → mudo
 *  S            → aleatório
 *  R            → cicla repetição
 *  /            → foca a busca
 *  Esc          → fecha fila/player expandido
 *
 * Ignorado quando o foco está em campo de texto ou em elemento com
 * comportamento próprio de teclado (slider, botão, link) — evita disparo
 * duplo de setas/espaço.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // campo de texto: bloqueia tudo (inclusive o "/")
      const inTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      // slider com foco trata as setas no próprio componente
      const isSlider = target?.matches?.('[role="slider"]') === true;
      // botão/link com foco: o navegador já ativa com espaço — se o handler
      // global também agisse, o clique dispararia duas vezes e anularia
      const isActivatable = target?.matches?.('button, a, [role="button"], [role="menuitem"]') === true;

      const store = usePlayerStore.getState();

      // o componente focado já tratou e cancelou a tecla
      if (e.defaultPrevented) return;

      if (e.key === 'Escape') {
        if (store.expanded) store.setExpanded(false);
        else if (store.queueOpen) store.setQueueOpen(false);
        return;
      }

      // "/" foca a busca mesmo vindo de qualquer lugar
      if (e.key === '/' && !inTextField) {
        const input = document.querySelector<HTMLInputElement>('input.glass-input');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      if (inTextField) return;

      switch (e.key) {
        case ' ':
          if (isActivatable) return;
          e.preventDefault();
          void store.togglePlay();
          break;

        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'ArrowDown':
          if (isSlider) return;
          e.preventDefault();
          if (e.key === 'ArrowUp') store.setVolume(store.volume + 0.05);
          else if (e.key === 'ArrowDown') store.setVolume(store.volume - 0.05);
          else if (e.shiftKey) {
            if (e.key === 'ArrowRight') void store.next();
            else void store.prev();
          } else {
            store.seek(store.currentTime + (e.key === 'ArrowRight' ? 10 : -10));
          }
          break;

        case 'm':
        case 'M':
          store.toggleMute();
          break;

        case 's':
        case 'S':
          store.toggleShuffle();
          break;

        case 'r':
        case 'R':
          store.cycleRepeat();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
