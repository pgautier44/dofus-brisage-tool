import type { LineConfig, LineKey, LineValues, RuneConfig } from './types';

/** Poids max du jet sans PA (somme des plafonds de lignes × leur poids/point) */
export const WMAX = 361;

/** Nombre de runes posées au-delà duquel une simulation automatique est arrêtée */
export const RUNE_LIMIT = 500;

/** Objectif du puits : au-delà, un échec de Ga Pa est entièrement absorbé */
export const PUITS_TARGET = 100;

export const LINES: Record<LineKey, LineConfig> = {
  pa: { key: 'pa', label: 'PA (exo)', min: 0, max: 0, weightPerPoint: 100, minOk: 1 },
  vi: { key: 'vi', label: 'Vitalité', min: 101, max: 130, weightPerPoint: 0.2, minOk: 115 },
  age: { key: 'age', label: 'Agilité', min: 26, max: 40, weightPerPoint: 1, minOk: 36 },
  pui: { key: 'pui', label: 'Puissance', min: 6, max: 10, weightPerPoint: 2, minOk: 8 },
  cri: { key: 'cri', label: '% Critique', min: 3, max: 4, weightPerPoint: 10, minOk: 4 },
  do: { key: 'do', label: 'Dommages', min: 4, max: 6, weightPerPoint: 20, minOk: 5 },
  rair: { key: 'rair', label: '% Résistance Air', min: 5, max: 7, weightPerPoint: 6, minOk: 5 },
  rterre: { key: 'rterre', label: 'Résistances Terre', min: 5, max: 7, weightPerPoint: 2, minOk: 5 },
  rfeu: { key: 'rfeu', label: 'Résistances Feu', min: 5, max: 7, weightPerPoint: 2, minOk: 5 },
  pro: { key: 'pro', label: 'Prospection', min: 11, max: 15, weightPerPoint: 3, minOk: null },
};

export const LINE_ORDER: LineKey[] = ['pa', 'vi', 'age', 'pui', 'cri', 'do', 'rair', 'rterre', 'rfeu', 'pro'];

export const RUNES: RuneConfig[] = [
  { id: 'gaPa', label: 'Ga Pa', line: 'pa', gain: 1, weight: 100, shortcut: 'G' },
  { id: 'vi', label: 'Vi', line: 'vi', gain: 5, weight: 1, shortcut: '1' },
  { id: 'paVi', label: 'Pa Vi', line: 'vi', gain: 15, weight: 3, shortcut: '2' },
  { id: 'raVi', label: 'Ra Vi', line: 'vi', gain: 50, weight: 10, shortcut: '3' },
  { id: 'age', label: 'Age', line: 'age', gain: 1, weight: 1, shortcut: '4' },
  { id: 'paAge', label: 'Pa Age', line: 'age', gain: 3, weight: 3, shortcut: '5' },
  { id: 'raAge', label: 'Ra Age', line: 'age', gain: 10, weight: 10, shortcut: '6' },
  { id: 'pui', label: 'Pui', line: 'pui', gain: 1, weight: 2, shortcut: '7' },
  { id: 'paPui', label: 'Pa Pui', line: 'pui', gain: 3, weight: 6, shortcut: '8' },
  { id: 'cri', label: 'Cri', line: 'cri', gain: 1, weight: 10, shortcut: '9' },
  { id: 'do', label: 'Do', line: 'do', gain: 1, weight: 20, shortcut: '0' },
  { id: 'rair', label: 'Ré Per Air', line: 'rair', gain: 1, weight: 6, shortcut: 'Q' },
  { id: 'rterre', label: 'Ré Terre', line: 'rterre', gain: 1, weight: 2, shortcut: 'W' },
  { id: 'rfeu', label: 'Ré Feu', line: 'rfeu', gain: 1, weight: 2, shortcut: 'E' },
];

export const RUNE_BY_ID: Record<string, RuneConfig> = Object.fromEntries(RUNES.map((r) => [r.id, r]));

export const MON_ANNEAU_HDV_PRICE_DEFAULT = 149000;

export const MON_ANNEAU_HDV_VALUES: LineValues = {
  pa: 0,
  vi: 115,
  age: 39,
  pui: 9,
  cri: 4,
  do: 5,
  rair: 5,
  rterre: 6,
  rfeu: 7,
  pro: 15,
};

export function randomAnneauValues(rng: () => number): LineValues {
  const values: Partial<LineValues> = { pa: 0 };
  for (const key of LINE_ORDER) {
    if (key === 'pa') continue;
    const line = LINES[key];
    const span = line.max - line.min;
    values[key] = line.min + Math.floor(rng() * (span + 1));
  }
  return values as LineValues;
}
