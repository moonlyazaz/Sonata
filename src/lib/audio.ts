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
 * O grafo nasce no PRIMEIRO gesto do usuário (pointerdown/keydown lá embaixo),
 * não quando o visualizador abre: assim o AudioContext já nasce `running`
 * antes de qualquer música tocar e todo áudio seguinte rota por ele sem risco
 * de silêncio. Até esse primeiro toque o áudio segue direto no elemento.
 *
 * Dois pontos que derrubam a reprodução se errarem:
 *
 *  1. `createMediaElementSource` DESCONECTA a saída do elemento — é obrigatório
 *     encadear até `destination`. A ligação direta é feita ANTES de construir
 *     a cadeia, como garantia: se algo falhar no meio, o som continua (talvez
 *     duplicado, mas nunca mudo).
 *  2. `AudioContext` criado FORA de um gesto nasce `suspended` — o áudio
 *     roteado pra um contexto suspenso sai mudo. Por isso `criarGrafo` só é
 *     chamado de dentro do listener de gesto, nunca de um `getAnalyser()` nem
 *     de um loop de rAF. O `pointerdown`/`keydown` seguinte reacorda o
 *     contexto (é o que salva no iOS, que o suspenso em segundo plano).
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
 * Analyser do espectro, ou `null` enquanto o grafo não existe.
 *
 * Leitor puro, sem efeito colateral — NÃO cria nada aqui de propósito. A
 * criação acontece só no listener de gesto lá embaixo: um `new AudioContext()`
 * fora de um gesto nasce `suspended`, e o áudio roteado pra um contexto
 * suspenso sai mudo.
 */
export function getAnalyser(): AnalyserNode | null {
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

/* ------------------------------------------------------------------ */
/* Barras do "tocando agora" (TrackRow.eq-bars)                        */
/* ------------------------------------------------------------------ */

/*
 * Um só loop pro app inteiro: um `requestAnimationFrame` por `EqBars` seria
 * desperdício, e re-renderizar React 60×/s por faixa seria caro. Aqui o loop
 * lê a FFT e escreve `--eq-1/2/3` direto no `<html>`; o CSS (globals.css)
 * só troca a altura dessas variáveis. Zero re-render, e todas as barrinhas
 * sincronizam sozinhas.
 */

const eqRaiz: HTMLElement | null =
  typeof document === 'undefined' ? null : document.documentElement;
const eqNiveis = [0, 0, 0];
/** grave · médio · agudo — fatias dos 256 bins do fftSize 512 */
const EQ_FAIXAS: ReadonlyArray<readonly [number, number]> = [
  [1, 8],
  [8, 40],
  [40, 120],
];

let eqRefs = 0;
let eqRaf = 0;
let eqDados = new Uint8Array(0);

function eqTick(): void {
  eqRaf = requestAnimationFrame(eqTick);

  const an = getAnalyser();
  // Sem grafo (nenhum toque na página ainda) a gente só espera: o CSS mantém
  // a animação falsa de sempre e ninguém nota a troca.
  if (!an || !eqRaiz) return;

  if (eqDados.length !== an.frequencyBinCount) eqDados = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(eqDados);

  eqRaiz.classList.add('eq-live');

  for (let b = 0; b < 3; b++) {
    const [ini, fim] = EQ_FAIXAS[b];
    let soma = 0;
    let n = 0;
    for (let i = ini; i < fim && i < eqDados.length; i++) {
      soma += eqDados[i];
      n++;
    }
    const alvo = n ? (soma / n / 255) ** 0.8 : 0;
    const atual = eqNiveis[b];
    // ataque rápido, queda lenta — o mesmo truque das barras do visualizador
    eqNiveis[b] = alvo > atual ? atual + (alvo - atual) * 0.45 : Math.max(0, atual - 0.065);
    // 25%..100%, a mesma faixa que o `@keyframes eq` usava
    eqRaiz.style.setProperty(`--eq-${b + 1}`, `${(25 + eqNiveis[b] * 75).toFixed(1)}%`);
  }
}

/**
 * Liga/desliga o loop das barrinhas (refcount). `EqBars` chama na montagem e
 * cancela na desmontagem — quando o último sai, o loop morre e a classe
 * `eq-live` volta pro CSS animado.
 */
export function ativarEqBars(): () => void {
  eqRefs += 1;
  if (eqRefs === 1 && !eqRaf) eqRaf = requestAnimationFrame(eqTick);

  return () => {
    eqRefs -= 1;
    if (eqRefs > 0 || !eqRaf) return;
    cancelAnimationFrame(eqRaf);
    eqRaf = 0;
    eqRaiz?.classList.remove('eq-live');
    eqRaiz?.style.removeProperty('--eq-1');
    eqRaiz?.style.removeProperty('--eq-2');
    eqRaiz?.style.removeProperty('--eq-3');
    eqNiveis[0] = eqNiveis[1] = eqNiveis[2] = 0;
  };
}

/*
 * GESTO — é aqui, e só aqui, que o grafo é criado. `criarGrafo` é
 * idempotente (um `analyser` já existente devolve na hora), então pode ficar
 * em todo toque: custa uma checagem de null e garante que o AudioContext
 * nasça `running` dentro da ativação do usuário. É também a rede de segurança
 * contra o contexto ser suspenso (autoplay, aba em segundo plano no iOS).
 */
if (typeof window !== 'undefined') {
  const gesto = () => {
    criarGrafo();
    acordar();
  };
  window.addEventListener('pointerdown', gesto, { capture: true });
  window.addEventListener('keydown', gesto, { capture: true });
  document.addEventListener('visibilitychange', acordar);
}
