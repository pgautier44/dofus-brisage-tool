import { LINES, LINE_ORDER } from './config';
import type { LineKey, LossDetail, ObjectState, Rng } from './types';

export interface ApplyLossOptions {
  /** La rune qui vient d'échouer est-elle une Ga Pa ? (jamais ciblée pour la perte de PA) */
  isGaPaRune: boolean;
  rng: Rng;
}

export interface ApplyLossResult {
  nextState: ObjectState;
  detail: LossDetail;
}

/**
 * Applique une perte de `montant` (en poids) sur l'objet, en épargnant `ligneExclue`
 * (la ligne qu'on vient de viser avec succès neutre, ou qu'on visait en cas d'échec).
 * Le puits absorbe en premier ; le reste retire des points sur une ligne choisie au
 * hasard (avec 25% de chance de viser le PA si les conditions sont réunies) ; tout
 * excédent dû à l'arrondi en points entiers retombe en reliquat dans le puits.
 */
export function applyLoss(
  state: ObjectState,
  montant: number,
  ligneExclue: LineKey,
  opts: ApplyLossOptions
): ApplyLossResult {
  let puits = state.puits;
  const values = { ...state.values };

  const fromPuits = Math.min(puits, montant);
  puits -= fromPuits;
  let remaining = montant - fromPuits;

  const linesLost: { line: LineKey; points: number }[] = [];
  let reliquat = 0;

  while (remaining > 0) {
    const paPresent = values.pa > 0;
    let target: LineKey;

    if (paPresent && !opts.isGaPaRune && remaining >= 10 && opts.rng() < 0.25) {
      target = 'pa';
    } else {
      const candidates = LINE_ORDER.filter(
        (k) => k !== ligneExclue && k !== 'pa' && values[k] > 0
      );
      if (candidates.length === 0) {
        reliquat += remaining;
        remaining = 0;
        break;
      }
      target = candidates[Math.floor(opts.rng() * candidates.length)];
    }

    const line = LINES[target];
    const maxPointsByRule = Math.max(1, Math.round(line.max * 0.35));
    const maxPointsByBudget = Math.ceil(remaining / line.weightPerPoint);
    const pointsToRemove = Math.min(values[target], maxPointsByRule, maxPointsByBudget);

    if (pointsToRemove <= 0) {
      reliquat += remaining;
      remaining = 0;
      break;
    }

    values[target] -= pointsToRemove;
    linesLost.push({ line: target, points: pointsToRemove });

    const weightRemoved = pointsToRemove * line.weightPerPoint;
    if (weightRemoved > remaining) {
      reliquat += weightRemoved - remaining;
      remaining = 0;
    } else {
      remaining -= weightRemoved;
    }
  }

  puits = Math.round((puits + reliquat) * 10) / 10;

  return {
    nextState: { values, puits },
    detail: { fromPuits, linesLost, reliquat },
  };
}
