import { LINES, LINE_ORDER } from './config';
import type { GoalOverrides, LineKey, LineValues, ObjectState } from './types';

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

/**
 * Minimum visé pour une ligne : celui défini par l'utilisateur (`goals`) s'il existe,
 * sinon le minOk par défaut de config.ts.
 */
export function effectiveMinOk(line: LineKey, goals?: GoalOverrides): number | null {
  if (goals && Object.prototype.hasOwnProperty.call(goals, line)) {
    return goals[line] ?? null;
  }
  return LINES[line].minOk;
}

export function isGoalReached(state: ObjectState, goals?: GoalOverrides): boolean {
  if (state.values.pa < 1) return false;
  for (const key of LINE_ORDER) {
    if (key === 'pa') continue;
    const minOk = effectiveMinOk(key, goals);
    if (minOk === null) continue;
    if (state.values[key] < minOk) return false;
  }
  return true;
}
