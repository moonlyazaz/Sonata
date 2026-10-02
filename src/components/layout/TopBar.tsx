import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Menu, Loader2, LogOut, Camera, X } from 'lucide-react';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/stores/authStore';
import { AVATAR_ACCEPT, reduzirParaAvatar } from '@/lib/avatar';

interface TopBarProps {
  onOpenMenu: () => void;
}

/** Barra superior: menu mobile, voltar/avançar e busca persistente. */
export function TopBar({ onOpenMenu }: TopBarProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  const [q, setQ] = useState(params.get('q') ?? '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // Sincroniza quando a URL muda por fora (ex: clique na sidebar "Buscar")
  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Debounce 300ms → navega para /search com o termo
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const term = q.trim();
    if (!term) {
      setBusy(false);
      if (urlQ) navigate('/search', { replace: true });
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(term)}`, { replace: true });
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
    else inputRef.current?.focus();
  };

  return (
    <header
      className="glass-panel sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-3 px-4"
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      {isMobile ? (
        <button className="glass-icon-btn" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      ) : (
        <div className="flex gap-1">
          <button
            className="glass-icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            title="Voltar"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="glass-icon-btn hidden sm:inline-flex"
            onClick={() => navigate(1)}
            aria-label="Avançar"
            title="Avançar"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          size={17}
          className="text-faint pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
        />
        <input
          ref={inputRef}
          className="glass-input !pl-11 !pr-10"
          placeholder="O que você quer ouvir?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar músicas, artistas, álbuns"
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2">
          {busy ? <Loader2 size={16} className="text-muted animate-spin" /> : null}
        </span>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <AccountMenu />
      </div>
    </header>
  );
}

/**
 * Ícone da pessoinha → menu da conta.
 *
 * O menu é renderizado por `createPortal` em `document.body`, e não aqui dentro:
 * o `TopBar` é `.glass-panel`, que tem `overflow: hidden` **e** `backdrop-filter`
 * — este último cria contexto de posicionamento, então nem `fixed` escaparia do
 * recorte. É o mesmo motivo de o host do `PlaylistDialog` morar no `AppShell`.
 */
function AccountMenu() {
  const usuario = useAuthStore((s) => s.user);
  const sair = useAuthStore((s) => s.sair);
  const atualizarAvatar = useAuthStore((s) => s.atualizarAvatar);

  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  // Fecha com clique fora e com Esc.
  //
  // O teste de contenção precisa incluir o PRÓPRIO menu: ele é portalizado em
  // `document.body`, fora de `raiz`. Sem isso, um clique real em "Sair da conta"
  // dispara `mousedown` → o item é considerado "de fora" → o menu desmonta →
  // e o `click` seguinte não encontra mais elemento, então o `onClick` do item
  // nunca roda e a conta continua logada.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (raiz.current?.contains(alvo) || menu.current?.contains(alvo)) return;
      setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  function alternar() {
    if (!aberto && botao.current) {
      const r = botao.current.getBoundingClientRect();
      setPos({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
      setErro(null);
    }
    setAberto((v) => !v);
  }

  /**
   * O `<input type="file">` fica em `raiz`, e não dentro do menu, de propósito:
   * o menu desmonta quando fecha. Como o diálogo de arquivos é nativo e leva um
   * tempinho, se o input morresse junto o `change` não teria mais onde disparar
   * e a foto escolhida seria perdida em silêncio.
   */
  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // deixa escolher o MESMO arquivo de novo
    if (!file) return;
    setErro(null);
    setProcessando(true);
    try {
      await atualizarAvatar(await reduzirParaAvatar(file));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar esta imagem.');
    } finally {
      setProcessando(false);
    }
  }

  async function remover() {
    setErro(null);
    setProcessando(true);
    try {
      await atualizarAvatar(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui remover a foto.');
    } finally {
      setProcessando(false);
    }
  }

  const inicial = (usuario?.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const foto = usuario?.avatar;

  return (
    <div ref={raiz} className="relative">
      <input
        ref={arquivo}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        aria-label="Escolher foto de perfil"
        onChange={aoEscolher}
      />

      <button
        ref={botao}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white transition-transform duration-200 hover:scale-105"
        style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)' }}
        aria-label="Sua conta"
        title={usuario ? `${usuario.name} — conta` : 'Sua conta'}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={alternar}
      >
        {foto ? (
          <img src={foto} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          inicial
        )}
      </button>

      {aberto &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label="Menu da conta"
            className="glass-panel fixed z-[60] w-[276px] p-1.5"
            style={{ top: pos.top, right: pos.right, borderRadius: 'var(--radius-md)' }}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 px-3 pt-3 pb-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)' }}
                  aria-hidden
                >
                  {foto ? (
                    <img src={foto} alt="" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    inicial
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] leading-tight font-semibold">
                    {usuario?.name ?? 'Sua conta'}
                  </span>
                  <span className="text-faint block truncate text-xs">{usuario?.email}</span>
                </span>
              </div>

              <div className="mx-2 mb-1.5 h-px bg-white/10" />

              <button
                role="menuitem"
                className="nav-item w-full"
                disabled={processando}
                onClick={() => arquivo.current?.click()}
              >
                <Camera size={17} />
                <span>{processando ? 'Salvando…' : 'Trocar foto'}</span>
                {processando && <Loader2 size={15} className="text-muted animate-spin" />}
              </button>

              {foto && (
                <button
                  role="menuitem"
                  className="nav-item w-full"
                  disabled={processando}
                  onClick={() => void remover()}
                >
                  <X size={17} />
                  <span>Remover foto</span>
                </button>
              )}

              {erro && <p className="glass-erro mx-2 mt-1 mb-1.5">{erro}</p>}

              <div className="mx-2 mt-1.5 mb-1 h-px bg-white/10" />

              <button
                role="menuitem"
                className="nav-item w-full"
                disabled={processando}
                onClick={() => {
                  setAberto(false);
                  void sair();
                }}
              >
                <LogOut size={17} />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
