import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

type Modo = 'entrar' | 'cadastrar';

/**
 * Tela de login/cadastro — primeira coisa que aparece para quem abre o site.
 *
 * `autoComplete` é preenchido por modo, porque os dois fluxos pedem senhas
 * diferentes ao gerenciador (`current-password` vs `new-password`); trocar o
 * atributo junto com a aba é o que faz o Chrome salvar e sugerir certo.
 */
export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const entrar = useAuthStore((s) => s.entrar);
  const cadastrar = useAuthStore((s) => s.cadastrar);

  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // já tem sessão validada no boot → volta para o app
  if (status === 'pronto' && user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      // sucesso recarrega a página (ver `authStore`) — o `setOcupado(false)`
      // abaixo nunca roda nesse caminho, e é isso que queremos
      if (modo === 'entrar') await entrar({ email, password: senha });
      else await cadastrar({ name: nome, email, password: senha });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível continuar.');
      setOcupado(false);
    }
  }

  function trocarModo(novo: Modo) {
    if (ocupado || novo === modo) return;
    setModo(novo);
    setErro('');
  }

  return (
    // `body` tem `overflow: hidden` (herança do app) — o scroll do login tem
    // que acontecer aqui dentro, senão um celular baixo cortaria o formulário.
    // Os blobs são `position: fixed` e não são recortados por este contêiner.
    <div className="relative min-h-screen overflow-y-auto">
      <div className="app-bg" aria-hidden>
        <div className="app-bg__blob app-bg__blob--1" />
        <div className="app-bg__blob app-bg__blob--2" />
        <div className="app-bg__blob app-bg__blob--3" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-[416px]"
      >
        <header className="mb-7 flex flex-col items-center gap-3 text-center">
          <Logo size={56} />
          <span className="sonata-word text-3xl font-bold tracking-[-0.02em]">Sonata</span>
          <p className="text-muted max-w-[300px] text-sm leading-relaxed">
            Entre para levar sua música com você — curtidas, playlists e o que você estava
            ouvindo ficam na sua conta.
          </p>
        </header>

        {/* `relative z-10`: `.glass-panel::before` é uma pseudo-elemento
            posicionado com z-index 0 e pintaria POR CIMA dos filhos estáticos
            — é o mesmo motivo de o componente GlassPanel embrulhar o conteúdo. */}
        <form className="glass-panel p-6 sm:p-7" onSubmit={onSubmit}>
          <div className="relative z-10">
          <div className="glass-tabs" role="tablist" aria-label="Entrar ou criar conta">
            <button
              type="button"
              role="tab"
              className="glass-tabs__btn"
              aria-selected={modo === 'entrar'}
              onClick={() => trocarModo('entrar')}
              disabled={ocupado}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              className="glass-tabs__btn"
              aria-selected={modo === 'cadastrar'}
              onClick={() => trocarModo('cadastrar')}
              disabled={ocupado}
            >
              Criar conta
            </button>
          </div>

          {erro && (
            <p className="glass-erro" role="alert">
              {erro}
            </p>
          )}

          {modo === 'cadastrar' && (
            <div className="glass-field">
              <label htmlFor="login-nome">Como quer ser chamado</label>
              <input
                id="login-nome"
                name="name"
                className="glass-input"
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                maxLength={80}
                disabled={ocupado}
              />
            </div>
          )}

          <div className="glass-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              name="email"
              className="glass-input"
              type="email"
              inputMode="email"
              autoComplete={modo === 'entrar' ? 'username' : 'email'}
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              disabled={ocupado}
            />
          </div>

          <div className="glass-field">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              name="password"
              className="glass-input"
              type="password"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              maxLength={200}
              disabled={ocupado}
            />
          </div>

          <button
            type="submit"
            className="glass-btn glass-btn--accent mt-1 w-full justify-center"
            disabled={ocupado}
          >
            {ocupado ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Aguarde…
              </>
            ) : modo === 'entrar' ? (
              <>
                <LogIn size={17} /> Entrar
              </>
            ) : (
              <>
                <UserPlus size={17} /> Criar conta
              </>
            )}
          </button>

          <p className="text-faint mt-5 text-center text-[12.5px] leading-relaxed">
            {modo === 'entrar'
              ? 'Ainda não tem conta? Use a aba “Criar conta”.'
              : 'Mínimo de 6 caracteres. Seus dados ficam separados por conta.'}
          </p>
          </div>
        </form>
      </motion.div>
      </div>
    </div>
  );
}
