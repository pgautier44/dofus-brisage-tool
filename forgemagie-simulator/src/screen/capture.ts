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

/**
 * Découpe une région (en fractions 0..1 de la frame) et l'agrandit (×3 par défaut) pour
 * améliorer la lecture OCR des petits chiffres de l'interface du jeu.
 */
export function cropRegion(frame: HTMLCanvasElement, region: CalibrationRegion, upscale = 3): HTMLCanvasElement {
  const sx = Math.round(region.x * frame.width);
  const sy = Math.round(region.y * frame.height);
  const sw = Math.max(1, Math.round(region.width * frame.width));
  const sh = Math.max(1, Math.round(region.height * frame.height));

  const out = document.createElement('canvas');
  out.width = sw * upscale;
  out.height = sh * upscale;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}
