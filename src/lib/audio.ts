/**
 * Instância única de áudio do app.
 *
 * Fora do React de propósito: o elemento sobrevive a trocas de rota e
 * desmontagens, então a música não para ao navegar.
 */
export const audio = new Audio();
audio.preload = 'auto';
audio.crossOrigin = 'anonymous';

/** volume padrão antes da primeira leitura do localStorage */
export const DEFAULT_VOLUME = 0.8;

let initialized = false;

/**
 * Conecta os eventos do elemento de áudio ao callback do player.
 * Idempotente — pode ser chamado mais de uma vez.
 */
export function initAudio(handlers: {
  onTime: (current: number, duration: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onCanPlay: () => void;
  onWaiting: () => void;
}): void {
  if (initialized) return;
  initialized = true;

  const onTime = () => {
    handlers.onTime(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0);
  };

  audio.addEventListener('timeupdate', onTime);
  audio.addEventListener('durationchange', onTime);
  audio.addEventListener('ended', handlers.onEnded);
  audio.addEventListener('canplay', handlers.onCanPlay);
  audio.addEventListener('waiting', handlers.onWaiting);
  audio.addEventListener('error', () => {
    const code = audio.error?.code;
    const map: Record<number, string> = {
      1: 'abortada',
      2: 'erro de rede',
      3: 'erro de decodificação',
      4: 'formato não suportado',
    };
    handlers.onError(map[code ?? 0] ?? 'erro desconhecido');
  });
}
