import { api, ApiError } from './api';

/**
 * Write-through: cada `save()` local é replicado para o Neon.
 *
 * Por que assim e não um "salva tudo no logout"? Porque a Vercel não tem disco
 * e o app pode morrer a qualquer momento (aba fechada, rede caindo, deploy).
 * Escrever tarde demais é perder dado; escrever daqui a 1,2s não — e o
 * debounce evita um `PUT` por clique.
 *
 * Este módulo é uma **folha** da árvore de imports: não importa `storage.ts`,
 * para não criar ciclo com `save()` que nos chama. Lê e escreve `localStorage`
 * direto.
 */

const DEBOUNCE_MS = 1200;
const MAX_TENTATIVAS = 3;

let ligado = false;
const sujos = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let falhasSeguidas = 0;

export function setSyncEnabled(value: boolean): void {
  ligado = value;
  if (!value) {
    sujos.clear();
    falhasSeguidas = 0;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
}

export function isSyncEnabled(): boolean {
  return ligado;
}

/** Chamado por `storage.save()`. Marca a chave como suja e reagenda o flush. */
export function noteChange(key: string): void {
  if (!ligado) return;
  sujos.add(key);
  falhasSeguidas = 0;
  agendar();
}

function agendar(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, DEBOUNCE_MS);
}

function coletar(keys: string[]): Record<string, unknown> {
  const items: Record<string, unknown> = {};
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw == null) continue;
    try {
      items[k] = JSON.parse(raw);
    } catch {
      /* valor corrompido — deixa para trás em vez de subir lixo */
    }
  }
  return items;
}

/**
 * Sobe as chaves sujas. Em falha elas voltam para a fila — menos em 401
 * (sessão caiu, não adianta insistir) e depois de `MAX_TENTATIVAS` seguidas
 * (rede fora: reenfileirar em loop só queima bateria e fila).
 */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!ligado || sujos.size === 0) return;

  const keys = [...sujos];
  sujos.clear();

  const items = coletar(keys);
  if (Object.keys(items).length === 0) return;

  try {
    await api.putData(items);
    falhasSeguidas = 0;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return;
    falhasSeguidas += 1;
    if (falhasSeguidas < MAX_TENTATIVAS) {
      for (const k of keys) sujos.add(k);
      agendar();
    }
  }
}

/**
 * Última chance antes de a aba morrer. Usa `sendBeacon` porque `fetch` é
 * assíncrono e a página pode ser descartada no meio — e beacon sempre manda
 * POST, por isso `/api/data` também aceita POST.
 */
function flushAntesDeSair(): void {
  if (!ligado || sujos.size === 0) return;
  const payload = new Blob([JSON.stringify({ items: coletar([...sujos]) })], {
    type: 'application/json',
  });
  try {
    if (navigator.sendBeacon('/api/data', payload)) {
      sujos.clear();
      falhasSeguidas = 0;
    }
  } catch {
    /* beacon indisponível — o debounce de 1,2s já deve ter descarregado */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAntesDeSair);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAntesDeSair();
  });
}
