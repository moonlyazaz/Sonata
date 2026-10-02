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

/* ------------------------------------------------------------------ */
/* Web Audio — leitura real do espectro, pro visualizador              */
/* ------------------------------------------------------------------ */

/*
 * O caminho só é aberto quando alguém abre o player expandido: até lá o áudio
 * continua no caminho direto do elemento, sem nenhuma chance de dar errado.
 *
 * Dois pontos que derrubam a reprodução se errarem:
 *
 *  1. `createMediaElementSource` DESCONECTA a saída do elemento — é obrigatório
 *     encadear `source → analyser → gain → destination`. Sem o `destination`
 *     o player toca mas fica mudo.
 *  2. `AudioContext` nasce `suspended` fora de um gesto → tudo mudo. Por isso o
 *     grafo é criado dentro do clique que abre a tela cheia, e qualquer
 *     `pointerdown`/`keydown` seguinte tenta acordá-lo de novo (é o que salva
 *     no iOS, que suspenso o contexto em segundo plano).
 *
 * Pré-requisito de CORS, já verificado nos dois lados: o `<audio>` está com
 * `crossOrigin = 'anonymous'` (linha 9) e o CDN do SoundCloud devolve
 * `Access-Control-Allow-Origin: *`. Sem isso o analyser receberia só zeros.
 *
 * `createMediaElementSource` aceita UM elemento UMA vez só — o `audio` é
 * singleton de módulo, então o próprio `analyser` serve de guarda.
 */

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let gain: GainNode | null = null;
/** volume lógico do app — vira o valor do GainNode depois do roteamento */
let volume = DEFAULT_VOLUME;
let mutado = false;
let acordando = false;
let falhou = false;

const AC =
  typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

/** Cria o grafo. Falha parcial = o áudio segue no caminho direto do elemento. */
function criarGrafo(): AnalyserNode | null {
  if (!AC || analyser || falhou) return analyser;

  let c: AudioContext;
  try {
    c = new AC();
  } catch {
    falhou = true;
    return null;
  }
  ctx = c;

  try {
    // Pega o volume que o store aplicou no elemento antes de neutralizá-lo
    volume = audio.volume;

    // Ponto sem volta: daqui em diante a saída do elemento passa por nós
    const source = c.createMediaElementSource(audio);

    // GARANTIA DE SOM antes de construir qualquer coisa. Se o bloco abaixo
    // estourar, o `catch` deixa essa ligação de pé — pode até duplicar, mas
    // nunca deixa o player mudo.
    source.connect(c.destination);

    const an = c.createAnalyser();
    an.fftSize = 512; // 256 bins — resolução suficiente pras barras
    an.smoothingTimeConstant = 0.8;

    const gn = c.createGain();
    gn.gain.value = mutado ? 0 : volume;

    source.connect(an);
    an.connect(gn);
    gn.connect(c.destination);

    // Só depois de tudo encadeado o gain passa a ser o dono do volume
    analyser = an;
    gain = gn;

    // Safari ignora `audio.volume` depois do roteamento; no Chrome ele ainda
    // valeria e multiplicaria pelo gain (volume²). Fixando em 1, o GainNode
    // controla o volume sozinho nos dois navegadores.
    audio.volume = 1;

    // `disconnect(destination)` derruba SÓ a ligação direta — a
    // source → analyser permanece intacta.
    source.disconnect(c.destination);

    c.addEventListener('statechange', acordar);
  } catch {
    falhou = true;
    // `gain` continua null: setAudioVolume volta a escrever em `audio.volume`
    // e a ligação direta de segurança garante som.
  }

  return analyser;
}

/** Tenta acordar o contexto. No-op barato quando não existe ou já rodando. */
function acordar(): void {
  if (!ctx || ctx.state === 'running' || acordando) return;
  acordando = true;
  void ctx.resume().finally(() => {
    acordando = false;
  });
}

/**
 * Analyser do espectro, ou `null` se o Web Audio não estiver disponível.
 * Criado sob demanda — a primeira chamada vem do efeito do player expandido,
 * que só monta depois de um clique.
 */
export function getAnalyser(): AnalyserNode | null {
  if (!analyser) criarGrafo();
  if (analyser) acordar();
  return analyser;
}

/**
 * Volume. Antes do grafo manda `audio.volume`; depois, o GainNode.
 * Chame no lugar de escrever em `audio.volume` direto.
 */
export function setAudioVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  mutado = false;
  audio.muted = false;
  // `gain` só existe quando a cadeia ficou completa — se o roteamento falhou
  // no meio, o elemento continua mandando e não pode ser neutralizado.
  audio.volume = gain ? 1 : volume;
  if (gain) gain.gain.value = volume;
}

/** Mute. Espelhado nos dois caminhos pelo mesmo motivo do volume acima. */
export function setAudioMuted(m: boolean): void {
  mutado = m;
  audio.muted = m;
  if (gain) gain.gain.value = m ? 0 : volume;
}

// Rede de segurança: o contexto pode ser suspenso pelo navegador (política de
// autoplay, aba em segundo plano no iOS). Qualquer toque acorda. Enquanto o
// grafo não existe, tudo aqui é no-op de uma checagem de null.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', acordar, { capture: true });
  window.addEventListener('keydown', acordar, { capture: true });
  document.addEventListener('visibilitychange', acordar);
}
