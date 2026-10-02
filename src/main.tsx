import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import './styles/glass.css';

/**
 * Sequência de boot — a ORDEM é o ponto:
 *
 *   1. `boot()` busca a sessão e puxa os dados da conta para o `localStorage`
 *   2. `setBoot()` grava o usuário no store de auth
 *   3. SÓ ENTÃO importamos a árvore de app
 *
 * Os stores do Zustand leem o `localStorage` quando o módulo é avaliado. Se o
 * `import { App }` viesse estático no topo, a biblioteca nasceria com o cache
 * deste navegador antes de o servidor dizer de quem ele é — e um usuário
 * logado veria as curtidas de quem usou a máquina antes dele. O import
 * dinâmico é o que garante a ordem.
 */
async function iniciar(): Promise<void> {
  let usuario = null;
  try {
    const { boot } = await import('./lib/boot');
    usuario = await boot();
  } catch (e) {
    // Sem servidor não há o que restaurar — cai na tela de login, que avisa.
    console.error('[sonata] falha no boot:', e);
  }

  try {
    const { setBoot } = await import('./stores/authStore');
    setBoot(usuario);

    const { App } = await import('./app/App');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    // Um único módulo quebrado derrubava o import dinâmico e a splash ficava
    // presa para sempre, sem nenhum indício. Agora ela vira a tela de erro.
    console.error('[sonata] falha ao montar o app:', e);
    mostrarErro();
    return;
  }

  // Some com a splash assim que o React tiver montado. O rAF é o caminho
  // limpo (a tela já pintou); o `setTimeout` é a rede de segurança, porque o
  // rAF fica pausado em aba que não está renderizando — sem ele, a splash
  // ficaria presa sobre o app num carregamento em segundo plano.
  const removerSplash = () => document.getElementById('boot')?.remove();
  requestAnimationFrame(removerSplash);
  window.setTimeout(removerSplash, 900);
}

/** Transforma a splash parada numa mensagem acionável. */
function mostrarErro(): void {
  const splash = document.getElementById('boot');
  if (!splash) return;

  splash.removeAttribute('aria-hidden');
  splash.querySelector('i')?.setAttribute('style', 'animation:none;opacity:.3');

  const aviso = document.createElement('div');
  aviso.style.cssText =
    'max-width:min(400px,84vw);text-align:center;font-size:13.5px;line-height:1.55;' +
    'color:rgba(255,255,255,.72);font-weight:400';
  aviso.textContent =
    'Não consegui abrir o Sonata. Recarregue a página — se continuar assim, ' +
    'abra o console para ver o erro.';
  splash.append(aviso);

  const botao = document.createElement('button');
  botao.textContent = 'Recarregar';
  botao.style.cssText =
    'padding:9px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.14);' +
    'background:linear-gradient(135deg,#38bdf8,#0284c7);color:#04121d;font:inherit;' +
    'font-size:13.5px;font-weight:600;cursor:pointer';
  botao.onclick = () => location.reload();
  splash.append(botao);
}

void iniciar();
