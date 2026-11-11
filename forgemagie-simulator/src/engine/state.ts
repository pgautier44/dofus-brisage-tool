import { LINES, LINE_ORDER } from './config';
import type { LineValues, ObjectState } from './types';

export function createObjectState(values: LineValues, puits = 0): ObjectState {
  return { values: { ...values }, puits };
}

export function cloneState(state: ObjectState): ObjectState {
  return { values: { ...state.values }, puits: state.puits };
}

/**
 * Poids actuel de l'objet, hors PA (WMAX=361 est lui-même défini comme la somme des
 * plafonds normaux hors PA — voir config.ts).
 */
export function currentWeight(state: ObjectState): number {
  let w = 0;
  for (const key of LINE_ORDER) {
    if (key === 'pa') continue;
    w += state.values[key] * LINES[key].weightPerPoint;
  }
  return w;
}

export function isGoalReached(state: ObjectState): boolean {
  if (state.values.pa < 1) return false;
  for (const key of LINE_ORDER) {
    const line = LINES[key];
    if (line.minOk === null) continue;
    if (key === 'pa') continue;
    if (state.values[key] < line.minOk) return false;
  }
  return true;
}
