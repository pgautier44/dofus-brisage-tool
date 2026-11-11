import { LINES } from './config';
import { calcSuccessProbability } from './probability';
import { lineCap } from './caps';
import { applyLoss } from './loss';
import { cloneState } from './state';
import type { ObjectState, Rng, RuneApplyResult, RuneConfig } from './types';

function applyGain(state: ObjectState, rune: RuneConfig): ObjectState {
  const values = { ...state.values };
  const line = LINES[rune.line];
  const cap = lineCap(line);
  values[rune.line] = Math.min(values[rune.line] + rune.gain, cap);
  return { values, puits: state.puits };
}

/**
 * Pose une rune sur l'objet : tire le résultat (critique / neutre / échec) selon la
 * probabilité calculée, applique le gain et/ou la perte correspondante, et renvoie le
 * détail complet de la pose (avant/après, perte, PA perdu ou non).
 *
 * Une Ga Pa n'a jamais de succès neutre : hors critique, c'est toujours un échec.
 */
export function applyRune(state: ObjectState, rune: RuneConfig, rng: Rng): RuneApplyResult {
  const before = cloneState(state);
  const paPresentBefore = before.values.pa > 0;
  const p = calcSuccessProbability(state, rune);
  const tirage = rng();

  let outcome: RuneApplyResult['outcome'];
  let after: ObjectState;
  let loss: RuneApplyResult['loss'] = null;

  if (tirage < p) {
    outcome = 'critique';
    after = applyGain(state, rune);
  } else {
    const isGaPaRune = rune.id === 'gaPa';
    const isNeutral = !isGaPaRune && rng() < 0.5;

    if (isNeutral) {
      outcome = 'neutre';
      const gained = applyGain(state, rune);
      const lossResult = applyLoss(gained, rune.weight, rune.line, { isGaPaRune, rng });
      after = lossResult.nextState;
      loss = lossResult.detail;
    } else {
      outcome = 'echec';
      const lossResult = applyLoss(state, rune.weight, rune.line, { isGaPaRune, rng });
      after = lossResult.nextState;
      loss = lossResult.detail;
    }
  }

  const paLost = paPresentBefore && after.values.pa === 0;

  return { rune, outcome, p, tirage, before, after, loss, paLost };
}
