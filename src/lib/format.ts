/** Formatação de valores usados no app. */

/** Segundos → "3:45" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** "1234567" → "1,2 mi" / "1234" → "1,2 mil" */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)} bi`;
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} mi`;
  if (n >= 1_000) return `${trim(n / 1_000)} mil`;
  return String(n);
}

function trim(v: number): string {
  return v.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

/** Saudação conforme a hora */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Extrai a cor dominante aproximada de uma imagem não é viável sem canvas
 *  pesado — usamos uma cor fixa por faixa como fallback determinístico. */
export function hueFromId(id: number): number {
  return id % 360;
}
