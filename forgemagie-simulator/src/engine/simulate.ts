import { RUNE_LIMIT } from './config';
import { applyRune } from './applyRune';
import { getCoachAdvice } from './coach';
import { cloneState, isGoalReached } from './state';
import type { GoalOverrides, ObjectState, Rng, RuneId, TrialSummary } from './types';

export interface SimulateOptions {
  rng: Rng;
  /** Prix (en kamas) de chaque rune, pour chiffrer le coût total de l'essai. */
  pricePerRune?: Partial<Record<RuneId, number>>;
  /** Minimums visés par l'utilisateur, remplaçant les minOk par défaut. */
  goals?: GoalOverrides;
}

/**
 * Joue un essai complet en suivant le coach à la lettre (boucle pilotée par
 * getCoachAdvice) : s'arrête dès que l'objectif est atteint, dès que le coach n'a
 * plus de rune sûre à conseiller (ex: "Accepte ou risque le PA"), ou après
 * RUNE_LIMIT poses.
 */
export function simulateTrial(initialState: ObjectState, options: SimulateOptions): TrialSummary {
  const { rng, pricePerRune = {}, goals } = options;
  let state: ObjectState = cloneState(initialState);
  const runeCounts: Partial<Record<RuneId, number>> = {};
  let gaPaCount = 0;
  let totalRunesPosed = 0;
  let cost = 0;
  let paLostInPhaseB = false;
  let stoppedByRuneLimit = false;

  while (true) {
    if (totalRunesPosed >= RUNE_LIMIT) {
      stoppedByRuneLimit = true;
      break;
    }

    const advice = getCoachAdvice(state, goals);
    if (advice.goalReached || !advice.rune) break;

    const wasPhaseB = advice.phase === 'B';
    const result = applyRune(state, advice.rune, rng);
    state = result.after;

    totalRunesPosed += 1;
    runeCounts[result.rune.id] = (runeCounts[result.rune.id] ?? 0) + 1;
    if (result.rune.id === 'gaPa') gaPaCount += 1;
    cost += pricePerRune[result.rune.id] ?? 0;
    if (wasPhaseB && result.paLost) paLostInPhaseB = true;
  }

  return {
    success: isGoalReached(state, goals),
    runeCounts,
    gaPaCount,
    totalRunesPosed,
    cost,
    finalState: state,
    paLostInPhaseB,
    stoppedByRuneLimit,
  };
}
