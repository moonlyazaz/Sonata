import { create } from 'zustand';
import { audio, DEFAULT_VOLUME, initAudio, setAudioMuted, setAudioVolume } from '@/lib/audio';
import { invalidateStream, resolveStream, type ScTrack } from '@/lib/soundcloud';
import { load, save, STORAGE_KEYS } from '@/lib/storage';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  /* fila */
  queue: ScTrack[];
  index: number;
  /** origem da fila, exibida no painel direito */
  contextLabel: string;

  /* transporte */
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error: string | null;

  /* preferências */
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;

  /* ui */
  expanded: boolean;
  queueOpen: boolean;

  /* ações */
  playTrack: (track: ScTrack, queue?: ScTrack[], contextLabel?: string) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  jumpTo: (queueIndex: number) => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enqueue: (track: ScTrack, position?: 'end' | 'next', label?: string) => void;
  enqueueMany: (tracks: ScTrack[], label?: string) => void;
  removeFromQueue: (queueIndex: number) => void;
  clearUpcoming: () => void;
  setExpanded: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;

  /* chamado pelo initAudio */
  _onTime: (current: number, duration: number) => void;
  _onEnded: () => void;
  _onError: (message: string) => void;
  _onLoading: () => void;
  _onReady: () => void;
}

/** Guarda contra loop infinito de "pula porque não toca". */
let consecutiveFailures = 0;
const MAX_FAILURES = 6;

/** Usada para cancelar um carregamento que ficou para trás. */
let loadToken = 0;

/* ------------------------------------------------------------------ */
/* Restauração — a música sobrevive a recarregar a página               */
/* ------------------------------------------------------------------ */

/**
 * O que gravamos em localStorage. `queue` guarda os `ScTrack` completos,
 * incluindo `media.transcodings` — então o stream pode ser resolvido de
 * novo sem refazer a busca, e a fila inteira volta como estava.
 */
interface SavedPlayer {
  queue: ScTrack[];
  index: number;
  contextLabel: string;
  currentTime: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

/** Posição (s) a aplicar quando o próximo stream carregar. */
let pendingSeek: number | null = null;
/**
 * Marca o próximo `loadCurrent` como restauração. Nesse caso falha de
 * autoplay NÃO pode pular a faixa (senão o navegador bloquearia o play
 * automático e a música do usuário sumiria da fila).
 */
let pendingRestore = false;

/** Espera o metadata do áudio — `currentTime` antes disso é ignorado. */
function seekWhenReady(el: HTMLMediaElement, seconds: number): Promise<void> {
  if (el.readyState >= 1) {
    // HAVE_METADATA: já é possível posicionar
    try {
      el.currentTime = seconds;
    } catch {
      /* posição fora do intervalo — ignora */
    }
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let handle = 0;
    const finish = () => {
      el.removeEventListener('loadedmetadata', finish);
      if (handle) window.clearTimeout(handle);
      try {
        el.currentTime = seconds;
      } catch {
        /* idem */
      }
      resolve();
    };
    // teto de 4s: se o metadata não chegar, seguimos sem seek em vez de travar
    handle = window.setTimeout(finish, 4000);
    el.addEventListener('loadedmetadata', finish, { once: true });
  });
}

function shuffleOrder(length: number, from: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== from);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [from, ...rest];
}

/** Ordem de reprodução atual (respeita shuffle). Vive fora da store para
 *  não serializar em cada render. */
let playOrder: number[] | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => {
  /** Carrega o stream da faixa atual e começa a tocar. */
  async function loadCurrent(): Promise<void> {
    const { queue, index } = get();
    const track = queue[index];
    if (!track) return;

    const token = ++loadToken;

    // Consome o pedido de restauração: vale só para ESTA faixa
    const seekTo = pendingSeek;
    const restoring = pendingRestore;
    pendingSeek = null;
    pendingRestore = false;

    set({
      isLoading: true,
      error: null,
      currentTime: seekTo ?? 0,
      duration: track.duration / 1000,
    });

    // Para imediatamente a faixa anterior: sem isso, os timeupdate dela
    // continuam chegando durante o carregamento e sobrescrevem o estado
    // (duration/c.currentTime da música velha aparecendo na nova).
    if (!audio.paused) audio.pause();

    // Nunca volta para uma posição já no fim da faixa: dispararia `ended`
    // na hora e a restauração pularia para a próxima música.
    const durationSec = track.duration / 1000;
    const target = seekTo != null ? Math.max(0, Math.min(seekTo, durationSec - 2)) : null;

    try {
      const url = await resolveStream(track);
      if (token !== loadToken) return; // outra faixa assumiu

      audio.src = url;
      audio.load();

      if (target != null && target > 0) {
        await seekWhenReady(audio, target);
        if (token !== loadToken) return;
      }

      if (restoring) {
        // Pode ser bloqueado sem gesto do usuário → fica pausado NA POSIÇÃO,
        // e o próximo clique em "Tocar" retoma dali (audio.src já existe).
        try {
          await audio.play();
          if (token !== loadToken) return;
          set({ isPlaying: true, isLoading: false });
        } catch {
          if (token !== loadToken) return;
          set({ isPlaying: false, isLoading: false });
        }
        updateMediaSession(track);
        return;
      }

      await audio.play();
      if (token !== loadToken) return;

      consecutiveFailures = 0;
      set({ isPlaying: true, isLoading: false });
      updateMediaSession(track);
    } catch (err) {
      if (token !== loadToken) return;

      // Restauração falhou (stream expirado, etc.): NÃO pula — a fila é
      // o estado que o usuário estava carregando e sumiria sem aviso.
      if (restoring) {
        set({
          isPlaying: false,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      consecutiveFailures += 1;

      // Faixa intransmissível (DRM/sem progressive) → pula para a próxima.
      // advance(true) ignora repeat-one, senão falharia em loop na mesma faixa.
      if (consecutiveFailures < MAX_FAILURES && get().queue.length > 1) {
        await advance(true);
        return;
      }

      set({
        isPlaying: false,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Índice seguinte/anterior na ordem de reprodução.
   * Devolve -1 quando não há para onde ir (fim da fila sem repetição).
   * O repeat 'one' NÃO é tratado aqui — ele só vale no fim natural da
   * faixa (ver advance), senão o botão "próxima" não funcionaria.
   */
  function nextIndex(direction: 1 | -1): number {
    const { queue, index, shuffle, repeat } = get();

    if (shuffle) {
      if (!playOrder || playOrder.length !== queue.length) {
        playOrder = shuffleOrder(queue.length, index);
      }
      const pos = playOrder.indexOf(index);
      const nextPos = pos + direction;
      if (nextPos >= 0 && nextPos < playOrder.length) return playOrder[nextPos];
      // fim da ordem
      if (direction === 1 && repeat === 'all' && playOrder.length > 0) return playOrder[0];
      return -1;
    }

    const next = index + direction;
    if (next >= 0 && next < queue.length) return next;
    if (direction === 1 && repeat === 'all' && queue.length > 0) return 0;
    return -1;
  }

  /**
   * Avança na fila.
   * `skipRepeatOne` = ação explícita (botão "próxima", atalho, ou pular uma
   * faixa que falhou ao carregar) — nunca respeita repeat-one.
   * Quando falso, é o fim natural da faixa e aí o repeat-one repete a mesma.
   */
  async function advance(skipRepeatOne: boolean): Promise<void> {
    const { queue, repeat } = get();
    if (queue.length === 0) return;

    if (repeat === 'one' && !skipRepeatOne) {
      // reinicia a mesma faixa sem rebuscar o stream
      audio.currentTime = 0;
      try {
        await audio.play();
        set({ isPlaying: true });
      } catch {
        await loadCurrent();
      }
      return;
    }

    const target = nextIndex(1);

    if (target === -1) {
      // fim da fila sem repetição → para
      audio.pause();
      set({ isPlaying: false });
      return;
    }

    set({ index: target });
    await loadCurrent();
  }

  return {
    queue: [],
    index: 0,
    contextLabel: '',

    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    error: null,

    shuffle: false,
    repeat: 'off',
    volume: load(STORAGE_KEYS.volume, DEFAULT_VOLUME),
    muted: false,

    expanded: false,
    queueOpen: false,

    async playTrack(track, queue, contextLabel) {
      const list = queue ?? [track];
      const idx = Math.max(0, list.findIndex((t) => t.id === track.id));
      playOrder = null;
      set({
        queue: list,
        index: idx,
        contextLabel: contextLabel ?? get().contextLabel,
        isPlaying: true,
        error: null,
      });
      await loadCurrent();
    },

    async togglePlay() {
      const { queue, isPlaying } = get();
      if (queue.length === 0) return;

      if (isPlaying) {
        audio.pause();
        set({ isPlaying: false });
        return;
      }

      // Retoma do ponto atual se já há um src carregado
      if (audio.src) {
        try {
          await audio.play();
          set({ isPlaying: true });
          return;
        } catch {
          /* cai no reload abaixo */
        }
      }
      await loadCurrent();
    },

    async next() {
      // botão "próxima": sempre avança, mesmo com repeat-one ligado
      await advance(true);
    },

    async prev() {
      const { currentTime } = get();
      if (get().queue.length === 0) return;
      // Comportamento do Spotify: se já passou de 3s, rebobina
      if (currentTime > 3) {
        audio.currentTime = 0;
        set({ currentTime: 0 });
        return;
      }
      const target = nextIndex(-1);
      if (target === -1) return; // já é a primeira faixa
      set({ index: target });
      await loadCurrent();
    },

    async jumpTo(queueIndex) {
      const { queue } = get();
      if (queueIndex < 0 || queueIndex >= queue.length) return;
      set({ index: queueIndex });
      await loadCurrent();
    },

    seek(seconds) {
      if (!audio.src) return;
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
      set({ currentTime: audio.currentTime });
    },

    setVolume(v) {
      const value = Math.min(1, Math.max(0, v));
      // não escreva em `audio.volume` direto: depois que o visualizador abre o
      // grafo Web Audio, o volume pertence ao GainNode (ver lib/audio.ts)
      setAudioVolume(value);
      set({ volume: value, muted: false });
      save(STORAGE_KEYS.volume, value);
    },

    toggleMute() {
      const next = !get().muted;
      setAudioMuted(next);
      set({ muted: next });
    },

    toggleShuffle() {
      const next = !get().shuffle;
      playOrder = next ? shuffleOrder(get().queue.length, get().index) : null;
      set({ shuffle: next });
    },

    cycleRepeat() {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const i = order.indexOf(get().repeat);
      set({ repeat: order[(i + 1) % order.length] });
    },

    enqueue(track, position = 'end', label) {
      const { queue, index, contextLabel } = get();
      if (queue.length === 0) {
        void get().playTrack(track, [track], label ?? contextLabel);
        return;
      }
      if (queue.some((t) => t.id === track.id)) return;
      const insertAt = position === 'next' ? index + 1 : queue.length;
      const next = [...queue];
      next.splice(insertAt, 0, track);
      playOrder = null;
      set({ queue: next });
    },

    /**
     * Acrescenta várias faixas ao fim da fila, pulando duplicatas.
     * Se a fila estiver vazia, começa a tocar em vez de só enfileirar.
     */
    enqueueMany(tracks, label) {
      if (tracks.length === 0) return;
      const { queue, contextLabel } = get();

      if (queue.length === 0) {
        void get().playTrack(tracks[0], tracks, label ?? contextLabel);
        return;
      }

      const existing = new Set(queue.map((t) => t.id));
      const fresh = tracks.filter((t) => !existing.has(t.id));
      if (fresh.length === 0) return;

      playOrder = null;
      set({ queue: [...queue, ...fresh] });
    },

    removeFromQueue(queueIndex) {
      const { queue, index } = get();
      if (queueIndex < 0 || queueIndex >= queue.length || queueIndex === index) return;

      const next = queue.filter((_, i) => i !== queueIndex);
      playOrder = null;
      set({
        queue: next,
        index: queueIndex < index ? index - 1 : index,
      });
    },

    clearUpcoming() {
      const { queue, index } = get();
      set({ queue: queue.slice(0, index + 1), index: 0 });
      playOrder = null;
    },

    setExpanded: (open) => set({ expanded: open }),
    setQueueOpen: (open) => set({ queueOpen: open }),

    _onTime: (current, duration) => {
      // Ignora eventos da faixa anterior enquanto a nova carrega
      if (get().isLoading) return;
      set({ currentTime: current, duration });
    },

    _onEnded: () => {
      // fim natural → aqui sim respeita repeat-one
      void advance(false);
    },

    _onError: (message) => {
      // URL de stream expirada (~5h) → renova uma vez e tenta de novo
      const track = get().queue[get().index];
      if (track && consecutiveFailures < 2) {
        consecutiveFailures += 1;
        invalidateStream(track.id);
        void loadCurrent();
        return;
      }
      set({ isPlaying: false, isLoading: false, error: message });
    },

    _onLoading: () => set({ isLoading: true }),
    _onReady: () => set({ isLoading: false }),
  };
});

/* ------------------------------------------------------------------ */
/* Media Session API — controles no teclado/lock screen do sistema     */
/* ------------------------------------------------------------------ */

function updateMediaSession(track: ScTrack): void {
  if (!('mediaSession' in navigator)) return;
  const store = usePlayerStore.getState();

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.user.username,
    album: track.genre || 'SoundCloud',
    artwork: track.artwork_url
      ? [
          { src: track.artwork_url.replace('-large', '-badge'), sizes: '48x48', type: 'image/jpeg' },
          { src: track.artwork_url.replace('-large', 't500x500'), sizes: '500x500', type: 'image/jpeg' },
        ]
      : [],
  });

  navigator.mediaSession.playbackState = store.isPlaying ? 'playing' : 'paused';

  const setAction = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* ação não suportada neste navegador */
    }
  };

  setAction('play', () => void store.togglePlay());
  setAction('pause', () => void store.togglePlay());
  setAction('nexttrack', () => void store.next());
  setAction('previoustrack', () => void store.prev());
  setAction('seekto', (details) => {
    if (details.seekTime != null) store.seek(details.seekTime);
  });
}

/* ------------------------------------------------------------------ */
/* Inicialização — liga o elemento de áudio à store                   */
/* ------------------------------------------------------------------ */

/** Serializa a fila atual em localStorage. */
function persistNow(): void {
  const s = usePlayerStore.getState();
  if (s.queue.length === 0) return;

  let queue = s.queue;
  let index = s.index;

  // Filas grandes passam de 1 MB e o localStorage tem ~5 MB; gravação pesada
  // trava a UI. Nesse caso guarda só a faixa atual + as 29 seguintes.
  if (queue.length > 40) {
    queue = s.queue.slice(s.index, s.index + 30);
    index = 0;
  }

  save(STORAGE_KEYS.lastTrack, {
    queue,
    index,
    contextLabel: s.contextLabel,
    currentTime: s.currentTime,
    shuffle: s.shuffle,
    repeat: s.repeat,
  } satisfies SavedPlayer);
}

/** Relê o que foi salvo e devolve a música de onde parou. */
function restoreSaved(): void {
  const saved = load<SavedPlayer | null>(STORAGE_KEYS.lastTrack, null);
  if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return;

  const index = Math.min(Math.max(0, saved.index ?? 0), saved.queue.length - 1);
  const track = saved.queue[index];
  if (!track || typeof track.id !== 'number') return; // payload corrompido

  const repeat: RepeatMode =
    saved.repeat === 'all' || saved.repeat === 'one' ? saved.repeat : 'off';
  const position = Number.isFinite(saved.currentTime) ? Math.max(0, saved.currentTime) : 0;

  pendingRestore = true;
  pendingSeek = position;

  usePlayerStore.setState({
    queue: saved.queue,
    index,
    contextLabel: saved.contextLabel ?? '',
    shuffle: Boolean(saved.shuffle),
    repeat,
    isPlaying: false,
    isLoading: true,
    currentTime: position,
    duration: track.duration / 1000,
    error: null,
  });

  void usePlayerStore.getState().jumpTo(index);
}

let started = false;

/** Chamar uma vez, na montagem do App. */
export function startPlayer(): void {
  if (started) return;
  started = true;

  const state = usePlayerStore.getState();
  setAudioVolume(state.volume);

  initAudio({
    onTime: (current, duration) => usePlayerStore.getState()._onTime(current, duration),
    onEnded: () => void usePlayerStore.getState()._onEnded(),
    onError: (msg) => usePlayerStore.getState()._onError(msg),
    onCanPlay: () => usePlayerStore.getState()._onReady(),
    onWaiting: () => usePlayerStore.getState()._onLoading(),
  });

  // Mantém o estado de playback do Media Session em sincronia
  if ('mediaSession' in navigator) {
    usePlayerStore.subscribe((s) => {
      navigator.mediaSession.playbackState = s.isPlaying ? 'playing' : 'paused';
    });
  }

  // Salva a fila quando ela muda (próxima faixa, enqueue, shuffle...)
  usePlayerStore.subscribe((s, prev) => {
    if (
      s.queue !== prev.queue ||
      s.index !== prev.index ||
      s.contextLabel !== prev.contextLabel ||
      s.shuffle !== prev.shuffle ||
      s.repeat !== prev.repeat
    ) {
      persistNow();
    }
  });

  // ...e a posição periodicamente, para um reload não voltar ao 0:00
  window.setInterval(() => {
    const s = usePlayerStore.getState();
    if (s.isPlaying && s.queue.length > 0) persistNow();
  }, 5000);

  // Depois de tudo ligado: recarrega a música de onde parou
  restoreSaved();

  // Depuração (apenas dev): expõe a store e rastreia toda mudança no tamanho
  // da fila com stack trace — foi como caçamos perda silenciosa de itens.
  if (import.meta.env.DEV) {
    const w = window as unknown as {
      __playerStore?: typeof usePlayerStore;
      __queueLog?: Array<{ de: number; para: number; indice: number; pilha: string }>;
    };
    w.__playerStore = usePlayerStore;
    w.__queueLog = [];

    let lastLen = usePlayerStore.getState().queue.length;
    usePlayerStore.subscribe((s) => {
      if (s.queue.length === lastLen) return;
      w.__queueLog?.push({
        de: lastLen,
        para: s.queue.length,
        indice: s.index,
        pilha: (new Error('q').stack ?? '').split('\n').slice(2, 8).join(' | '),
      });
      // não deixa o log crescer sem limite durante uma sessão longa
      if (w.__queueLog && w.__queueLog.length > 50) w.__queueLog.shift();
      lastLen = s.queue.length;
    });
  }
}
