/** Persistência simples em localStorage, com JSON seguro. */

import { noteChange } from './sync';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota cheia ou modo privado — ignora */
  }
  // todo `save` é um candidato a subir para o Neon — ver `lib/sync.ts`
  noteChange(key);
}

export const STORAGE_KEYS = {
  liked: 'sc:liked',
  playlists: 'sc:playlists',
  recent: 'sc:recent',
  volume: 'sc:volume',
  lastTrack: 'sc:last-track',
  searches: 'sc:searches',
} as const;

/**
 * As oito chaves gerenciadas — as seis acima mais os dois companion maps
 * (`:data`) que guardam os metadados das faixas curtidas e recentes.
 *
 * Esta é a **contraparte exata** de `MANAGED_KEYS` em `server/db.ts`. Se uma
 * lista mudar, a outra tem que mudar junto: o servidor rejeita chave fora da
 * lista e o cliente a ignora ao puxar.
 */
export const ALL_MANAGED_KEYS: readonly string[] = [
  STORAGE_KEYS.liked,
  `${STORAGE_KEYS.liked}:data`,
  STORAGE_KEYS.playlists,
  STORAGE_KEYS.recent,
  `${STORAGE_KEYS.recent}:data`,
  STORAGE_KEYS.volume,
  STORAGE_KEYS.lastTrack,
  STORAGE_KEYS.searches,
];
