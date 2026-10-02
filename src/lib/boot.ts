import { api, type ApiUser } from './api';
import { ALL_MANAGED_KEYS } from './storage';
import { setSyncEnabled } from './sync';

/**
 * Boot do app, antes do React.
 *
 * Os stores do Zustand leem o `localStorage` **no momento da importação do
 * módulo**. Se o servidor mandar os dados do usuário depois disso, as stores
 * já nasceriam com o conteúdo do navegador anterior — e um usuário logado
 * veria os dados de outro. Por isso o `main.tsx` espera o `boot()` terminar e
 * só então importa a árvore de app (import dinâmico, que é o que garante a
 * ordem).
 *
 * Política de conflito:
 *   • servidor tem dado                → **servidor vence**, local é sobrescrito
 *   • servidor vazio + local é desta conta → nada a puxar, mantém o local
 *   • servidor vazio + local ainda sem dono + tem dado local → **semeia** a conta
 *
 * O terceiro caso é a migração de quem usava o Sonata antes de existir login.
 * O segundo e o primeiro evitam o vazamento: os dados de A nunca viram
 * dados de B, porque `sc:owner` registra de quem o cache local é.
 */

const OWNER_KEY = 'sc:owner';

function lerLocal(): Record<string, unknown> {
  const items: Record<string, unknown> = {};
  for (const key of ALL_MANAGED_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      items[key] = JSON.parse(raw);
    } catch {
      /* ignora valor corrompido */
    }
  }
  return items;
}

/** Grava direto (sem `save()`) — senão a hidratação marcaria tudo como sujo. */
function aplicarServidor(items: Record<string, unknown>): void {
  for (const key of ALL_MANAGED_KEYS) {
    const value = items[key];
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
}

export async function boot(): Promise<ApiUser | null> {
  let user: ApiUser | null = null;
  try {
    user = (await api.me()).user;
  } catch {
    // 401 é o caso normal (sem cookie). Rede fora cai aqui também — e sem
    // sessão validada não há o que fazer além de mostrar a tela de login.
    user = null;
  }

  if (!user) {
    setSyncEnabled(false);
    return null;
  }

  const { items } = await api.getData().catch(() => ({ items: {} }));
  const servidorVazio = Object.keys(items).length === 0;

  if (servidorVazio) {
    const dono = localStorage.getItem(OWNER_KEY);
    const localTemDado = Object.keys(lerLocal()).length > 0;

    if (dono === user.id) {
      // o cache já é desta conta e o servidor não tem nada novo — mantém
    } else if (dono === null && localTemDado) {
      // primeira entrada: leva o que existia no navegador para a conta nova
      await api.putData(lerLocal()).catch(() => undefined);
    } else if (dono !== null) {
      // cache pertence a OUTRA conta — trocamos de usuário, então esvazia
      aplicarServidor({});
    }
  } else {
    aplicarServidor(items);
  }

  localStorage.setItem(OWNER_KEY, user.id);
  setSyncEnabled(true);
  return user;
}
