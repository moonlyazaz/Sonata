import { useEffect, useRef } from 'react';
import { getAnalyser } from '@/lib/audio';

interface AudioVisualizerProps {
  className?: string;
  /** nº fixo de barras; se omitido, calcula pela largura disponível */
  bars?: number;
}

/**
 * Visualizador de espectro com dados REAIS.
 *
 * Não é CSS animado: lê `AnalyserNode.getByteFrequencyData()` a cada frame e
 * desenha direto no canvas, sem passar por React — um estado no store mudando
 * 60× por segundo re-renderizaria a tela cheia inteira.
 *
 * A primeira chamada a `getAnalyser()` acontece no efeito de montagem, que só
 * roda depois do clique que abriu o player expandido — aí o AudioContext nasce
 * dentro de um gesto do usuário, que é o que a política de autoplay exige.
 */
export function AudioVisualizer({ className, bars }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;

    getAnalyser();

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let ultimoQuadro = 0;
    let grad: CanvasGradient | null = null;
    let data = new Uint8Array(0);
    let levels: number[] = [];

    // `prefers-reduced-motion`: mantém as barras, só as atualiza devagar
    const intervalo = reduzido ? 1000 / 12 : 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      w = Math.round(r.width);
      h = Math.round(r.height);
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      // reseta o sistema de coordenadas a cada resize
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#075985');
      grad.addColorStop(0.5, '#38bdf8');
      grad.addColorStop(1, '#e0f2fe');
      levels = [];
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (intervalo && ts - ultimoQuadro < intervalo) return;
      ultimoQuadro = ts;
      if (!w || !h) return;

      const an = getAnalyser();
      const n = bars ?? Math.max(24, Math.min(120, Math.round(w / 9)));
      if (levels.length !== n) levels = new Array<number>(n).fill(0);

      const bins = an ? an.frequencyBinCount : 0;
      if (an && data.length !== bins) data = new Uint8Array(bins);
      if (an) an.getByteFrequencyData(data);

      g.clearRect(0, 0, w, h);
      if (!grad) return;

      const gap = 3;
      const bw = Math.max(2, (w - gap * (n - 1)) / n);
      const alturaMax = h - 4;
      const base = h - 2;

      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0;
        // MP3 128kbps: a energia morre antes da metade do espectro, então o
        // expoente comprime as barras pro lado dos graves e o corte de 0.7
        // descarta os bins altos, que ficam vazios e só gerariam barulho visual
        const idx = bins ? Math.min(bins - 1, Math.floor(t ** 1.7 * bins * 0.7)) : 0;
        const bruto = bins ? data[idx] / 255 : 0;
        const alvo = an ? bruto ** 1.2 : 0;

        const anterior = levels[i];
        // ataque rápido, queda lenta — o "caimento" clássico das barras
        levels[i] =
          alvo > anterior ? anterior + (alvo - anterior) * 0.5 : Math.max(0, anterior - 0.055);

        const bh = Math.max(2, levels[i] * alturaMax);
        barraArredondada(g, i * (bw + gap), base - bh, bw, bh, base);
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bars]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

/** Barra com o topo arredondado, sem depender de `ctx.roundRect` (Safari <16). */
function barraArredondada(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
): void {
  const r = Math.min(w / 2, h);
  g.beginPath();
  g.moveTo(x, y + r);
  g.lineTo(x, base);
  g.lineTo(x + w, base);
  g.lineTo(x + w, y + r);
  g.arc(x + w / 2, y + r, r, Math.PI, Math.PI * 2);
  g.closePath();
  g.fill();
}
