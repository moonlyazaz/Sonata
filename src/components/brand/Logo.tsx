interface LogoProps {
  /** Lado da orbe em px. */
  size?: number;
  /**
   * Nome acessível. Ausente → a marca sai da árvore de acessibilidade, que é o
   * caso quando o wordmark textual está ao lado.
   */
  title?: string;
  className?: string;
}

/** Barras do equalizador: x, y, altura. Mesma geometria da splash e do favicon. */
const BARS = [
  { x: 12, y: 25, h: 14 },
  { x: 23, y: 16, h: 32 },
  { x: 34, y: 20, h: 24 },
  { x: 45, y: 27, h: 10 },
] as const;

/**
 * Marca da Sonata — a MESMA logo da splash do `index.html` e do
 * `public/favicon.svg`: círculo com gradiente azul (`#38bdf8 → #0284c7 →
 * `#082f49`, pintado em `.sonata-mark`) e quatro barras de equalizador
 * brancas por cima, nada mais.
 *
 * Sem sombra gravada, sem aro, sem especular: o que você vê na tela de
 * carregamento é exatamente o que aparece na sidebar, no login e na aba.
 *
 * Geometria das barras idêntica à da splash e do favicon — se mexer numa,
 * mexe nas três.
 *
 * O corpo é um `<div>` (não `<svg>`) porque o gradiente é CSS; o SVG dentro
 * só desenha as barras.
 */
export function Logo({ size = 30, title, className }: LogoProps) {
  const bars = (
    <g fill="#ffffff">
      {BARS.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width="7" height={b.h} rx="3.5" />
      ))}
    </g>
  );

  return (
    <span
      className={className ? `sonata-mark ${className}` : 'sonata-mark'}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false" aria-hidden="true">
        {bars}
      </svg>
    </span>
  );
}
