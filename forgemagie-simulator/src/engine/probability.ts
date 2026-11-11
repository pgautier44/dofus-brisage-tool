import { LINES, WMAX } from './config';
import { currentWeight } from './state';
import type { ObjectState, RuneConfig } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Probabilité de succès critique d'une pose, avant tirage.
 * - Ga Pa : impossible si le PA est déjà présent ; sinon p = 0.025 + 0.06 × clamp(1 − W/WMAX, 0, 1)
 * - Autres runes : p dépend de la proximité du max de la ligne, pénalisée au-delà (overmax),
 *   puis pénalisée encore si le poids total W dépasse WMAX. Clampée dans [0.03, 0.95].
 */
export function calcSuccessProbability(state: ObjectState, rune: RuneConfig): number {
  const W = currentWeight(state);

  if (rune.id === 'gaPa') {
    if (state.values.pa > 0) return 0;
    const ratio = clamp(1 - W / WMAX, 0, 1);
    return 0.025 + 0.06 * ratio;
  }

  const line = LINES[rune.line];
  const after = state.values[rune.line] + rune.gain;
  let p = after <= line.max ? 0.9 - 0.5 * (after / line.max) : 0.08;

  if (W > WMAX) p *= 0.7;

  return clamp(p, 0.03, 0.95);
}
