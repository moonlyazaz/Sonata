import type { StoredTrack } from '@/stores/libraryStore';
import type { ScTrack } from '@/lib/soundcloud';

/**
 * Reconstrói um `ScTrack` a partir do que salvamos em localStorage.
 * `StoredTrack` é um subconjunto dos campos — `media` fica indefinido de
 * propósito, e o player resolve o stream na hora em que você dá o play.
 */
export function storedToTrack(stored: StoredTrack): ScTrack {
  return {
    ...stored,
    kind: 'track',
    media: undefined,
  } as ScTrack;
}
