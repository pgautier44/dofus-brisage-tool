import { LINES } from './config';
import type { LineConfig, ObjectState, RuneConfig } from './types';

/**
 * Plafond au-delà duquel une ligne ne peut plus monter :
 * max + max(1, round(max * 0.25)). Le PA, lui, est toujours plafonné à 1.
 */
export function lineCap(line: LineConfig): number {
  if (line.key === 'pa') return 1;
  return line.max + Math.max(1, Math.round(line.max * 0.25));
}

/** true si poser cette rune ferait dépasser le plafond de sa ligne (rune désactivée) */
export function wouldExceedCap(state: ObjectState, rune: RuneConfig): boolean {
  const line = LINES[rune.line];
  return state.values[rune.line] + rune.gain > lineCap(line);
}

export function isRuneAvailable(state: ObjectState, rune: RuneConfig): boolean {
  if (rune.id === 'gaPa' && state.values.pa > 0) return false;
  return !wouldExceedCap(state, rune);
}
