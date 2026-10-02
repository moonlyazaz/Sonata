import { useCallback } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { resolveTracks, sc, type ScTrack } from '@/lib/soundcloud';

/**
 * Devolve uma função que toca `track` e usa a lista inteira como fila.
 * É o que faz o botão de play de uma lista reproduzir as próximas faixas.
 */
export function usePlayList(label?: string) {
  const playTrack = usePlayerStore((s) => s.playTrack);

  return useCallback(
    (track: ScTrack, list: ScTrack[], contextLabel?: string) => {
      void playTrack(track, list, contextLabel ?? label);
    },
    [playTrack, label],
  );
}

/** Toca uma faixa sozinha (fila de 1). */
export function usePlaySingle() {
  const playTrack = usePlayerStore((s) => s.playTrack);
  return useCallback((track: ScTrack) => void playTrack(track, [track]), [playTrack]);
}

/**
 * Busca as faixas de uma playlist/álbum pelo id e toca a partir da primeira.
 * Para os cards da Home, que só têm o id em mãos. Devolve `false` se falhar.
 */
export async function playCollectionById(id: number, label?: string): Promise<boolean> {
  try {
    const playlist = await sc.playlist(id);
    const tracks = await resolveTracks(playlist);
    if (tracks.length === 0) return false;
    await usePlayerStore.getState().playTrack(tracks[0], tracks, label ?? playlist.title);
    return true;
  } catch {
    return false;
  }
}
