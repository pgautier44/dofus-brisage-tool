import type { LineKey } from '../engine/types';

export type RegionKey = LineKey | 'puits';

/**
 * Zone de lecture calibrée par l'utilisateur, en fractions (0..1) de la largeur/hauteur
 * du flux capturé — pour rester valable tant que la fenêtre du jeu garde la même
 * position relative dans le partage d'écran, même si la résolution exacte varie un peu.
 */
export interface CalibrationRegion {
  key: RegionKey;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Calibration = Partial<Record<RegionKey, CalibrationRegion>>;

export interface ReadResult {
  key: RegionKey;
  rawText: string;
  value: number | null;
}
