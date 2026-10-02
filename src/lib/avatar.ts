/**
 * Redução de imagem de perfil — roda **inteira no navegador**, antes de
 * qualquer upload.
 *
 * Por que aqui e não no servidor: o arquivo original de um celular tem 3–8 MB,
 * passaria pelo limite de corpo do Vercel (~4,5 MB) e iria parar num banco com
 * 1 GB de teto. Cortando no cliente a gente envia ~13 KB em vez de ~5 MB — uma
 * diferença de 400×.
 */

/** Lado do quadrado final. 160 basta para 2× num avatar de 80px. */
export const AVATAR_TAMANHO = 160;

/** Espelha `MAX_AVATAR_CHARS` do `server/routes.ts`. */
export const AVATAR_MAX_CHARS = 64 * 1024;

/** Aceita o que o `<input type="file">` costuma aceitar. */
export const AVATAR_ACCEPT = 'image/webp,image/png,image/jpeg,image/gif,image/avif';

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não consegui ler esta imagem.'));
    };
    img.src = url;
  });
}

/** Converte `Blob` em data URL (`data:image/webp;base64,…`). */
function paraDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Falha ao ler a imagem reduzida.'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Corta ao centro em quadrado, redimensiona e comprime.
 *
 * O corte é central (e não "esticar"): fotos de retrato viram quadrado sem
 * deformar, e paisagens perdem só as laterais.
 */
export async function reduzirParaAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');

  const img = await carregarImagem(file);
  const lado = Math.min(img.naturalWidth, img.naturalHeight);
  if (!lado) throw new Error('Imagem sem dimensões.');

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_TAMANHO;
  canvas.height = AVATAR_TAMANHO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não permite desenhar a imagem.');

  // deixa a foto nítida ao reduzir (senão o navegador interpola uma vez só e borra)
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    (img.naturalWidth - lado) / 2,
    (img.naturalHeight - lado) / 2,
    lado,
    lado,
    0,
    0,
    AVATAR_TAMANHO,
    AVATAR_TAMANHO,
  );

  // WebP é ~30% menor que JPEG no mesmo tamanho. Firefox/Safari antigos não
  // suportam `toBlob('image/webp')` e devolvem nulo — daí o fallback.
  const blob =
    (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.8))) ??
    (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85)));
  if (!blob) throw new Error('Não consegui comprimir esta imagem.');

  const dataURL = await paraDataURL(blob);
  if (dataURL.length > AVATAR_MAX_CHARS) {
    throw new Error('Essa imagem continua pesada demais. Tente outra.');
  }
  return dataURL;
}
