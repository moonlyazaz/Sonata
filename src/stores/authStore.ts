import { create } from 'zustand';
import { api, type ApiUser, type Credentials } from '@/lib/api';
import { setSyncEnabled } from '@/lib/sync';

/**
 * Sessão de login.
 *
 * Entrar, cadastrar e sair **recarregam a página**. Não é preguiça: hidratar
 * as stores de biblioteca, curtidas e player depois da importação delas
 * exigiria um `rehydrate()` em cada uma — e qualquer esquecimento viraria um
 * vazamento silencioso de dados entre contas. Um reload executa o mesmo
 * `boot()` do primeiro acesso e resolve tudo num caminho só, já testado.
 */

interface AuthState {
  user: ApiUser | null;
  status: 'analisando' | 'pronto';
  entrar: (c: Credentials) => Promise<void>;
  cadastrar: (d: Credentials & { name: string }) => Promise<void>;
  sair: () => Promise<void>;
  /** `null` remove a foto. */
  atualizarAvatar: (avatar: string | null) => Promise<void>;
}

function irPara(path: string): void {
  window.location.assign(path);
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  status: 'analisando',

  entrar: async (c) => {
    await api.login(c);
    irPara('/');
  },

  cadastrar: async (d) => {
    await api.signup(d);
    irPara('/');
  },

  sair: async () => {
    setSyncEnabled(false);
    await api.logout().catch(() => undefined);
    irPara('/login');
  },

  /**
   * Ao contrário de entrar/cadastrar/sair, trocar a foto **não** recarrega:
   * não mexe em nenhuma store de dados, então não há risco de vazamento entre
   * contas — só o `user` da store de auth muda, e o avatar já é reativo.
   */
  atualizarAvatar: async (avatar) => {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('Faça login para trocar a foto.');
    const { user: salvo } = await api.putAvatar(avatar);
    useAuthStore.setState({ user: { ...user, ...salvo } });
  },
}));

/**
 * Chamado pelo `main.tsx` **antes** de importar a árvore de app — a ordem
 * importa, porque as stores leem o `localStorage` na importação do módulo.
 */
export function setBoot(user: ApiUser | null): void {
  useAuthStore.setState({ user, status: 'pronto' });
}
