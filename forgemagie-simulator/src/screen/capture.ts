import type { CalibrationRegion } from './types';

export async function startScreenCapture(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Ce navigateur ne permet pas le partage d'écran (getDisplayMedia indisponible).");
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 5 },
    audio: false,
  });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Capture la frame courante de la vidéo dans un canvas à sa résolution native. */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Hauteur de sortie (en pixels) visée après agrandissement, quelle que soit la taille
 *  source de la zone calibrée. Tesseract lit nettement mieux du texte dont les
 *  caractères font au moins quelques dizaines de pixels de haut ; les chiffres de
 *  l'interface de Dofus, eux, ne font souvent que 10-15px de haut à l'écran. */
const OCR_TARGET_HEIGHT_PX = 60;
const OCR_MAX_UPSCALE = 10;
const OCR_MIN_UPSCALE = 3;

/**
 * Découpe une région (en fractions 0..1 de la frame) et l'agrandit pour améliorer la
 * lecture OCR des petits chiffres de l'interface du jeu. Le facteur d'agrandissement
 * s'adapte à la taille de la zone source plutôt que d'être fixe : une zone minuscule
 * est beaucoup plus agrandie qu'une zone déjà large, pour viser toujours la même
 * hauteur de sortie.
 */
export function cropRegion(frame: HTMLCanvasElement, region: CalibrationRegion): HTMLCanvasElement {
  const sx = Math.round(region.x * frame.width);
  const sy = Math.round(region.y * frame.height);
  const sw = Math.max(1, Math.round(region.width * frame.width));
  const sh = Math.max(1, Math.round(region.height * frame.height));
  const upscale = Math.min(OCR_MAX_UPSCALE, Math.max(OCR_MIN_UPSCALE, Math.ceil(OCR_TARGET_HEIGHT_PX / sh)));

  const out = document.createElement('canvas');
  out.width = sw * upscale;
  out.height = sh * upscale;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/**
 * Étire le contraste d'une image en niveaux de gris sur toute la plage 0-255 : une
 * zone capturée sur un fond dégradé sombre (l'interface de Dofus) a souvent un
 * contraste texte/fond assez faible une fois réduite en niveaux de gris, ce qui gêne
 * Tesseract. Mutile le canvas en place et le renvoie pour chaînage.
 */
export function stretchContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const gray = new Float32Array(data.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[i / 4] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((gray[i / 4] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Copie une image en inversant ses couleurs (utile en repli si le texte est plus
 *  sombre que son fond sur une ligne donnée, l'inverse de l'hypothèse habituelle). */
export function invertColors(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');
  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
  return out;
}
