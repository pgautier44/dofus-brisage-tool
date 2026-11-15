import { LINES, RUNE_BY_ID, RUNES } from './config';
import { isRuneAvailable } from './caps';
import { calcSuccessProbability } from './probability';
import { effectiveMinOk, isGoalReached } from './state';
import type { CoachAdvice, GoalOverrides, LineKey, ObjectState, RuneConfig } from './types';

const PHASE_B_PRIORITY: LineKey[] = ['rair', 'age', 'pui', 'vi', 'rterre', 'rfeu'];

/** Runes jamais conseillées en phase B (Cri, Do, et toutes les runes Ga/Ra lourdes >= 10 de poids) */
function phaseBCandidateRunes(line: LineKey): RuneConfig[] {
  return RUNES.filter((r) => r.line === line && r.weight < 10);
}

function bestAvailableRune(state: ObjectState, candidates: RuneConfig[]): RuneConfig | null {
  const available = candidates.filter((r) => isRuneAvailable(state, r));
  if (available.length === 0) return null;
  // la rune au gain le plus fort fait progresser le plus vite vers le minOk
  return available.reduce((best, r) => (r.gain > best.gain ? r : best));
}

function advise(
  state: ObjectState,
  phase: CoachAdvice['phase'],
  rune: RuneConfig | null,
  reason: string,
  goalReached = false
): CoachAdvice {
  const p = rune ? calcSuccessProbability(state, rune) : null;
  return { phase, rune, reason, p, goalReached };
}

/** true si la ligne n'a pas d'exigence (minOk null) ou si sa valeur l'atteint déjà */
function meetsGoal(state: ObjectState, line: LineKey, goals?: GoalOverrides): boolean {
  const minOk = effectiveMinOk(line, goals);
  return minOk === null || state.values[line] >= minOk;
}

/**
 * Conseil du coach, en deux phases :
 * - Phase A (PA == 0) : on construit D'ABORD toutes les lignes sûres (poids < 10 : Ré
 *   Per Air, Agilité, Puissance, Vitalité, Ré Terre, Ré Feu) jusqu'à leur minimum
 *   visé, avant même de toucher à Cri, Do ou Ga Pa. Raison, vérifiée par simulation
 *   (20 000 essais, voir historique de commit) : une perte collatérale (echec/neutre)
 *   épargne la ligne qu'on vient de viser et tombe au hasard sur une AUTRE ligne non
 *   nulle. Si Cri et Do sont les seules lignes non nulles, elles se renvoient
 *   systématiquement la perte en boucle. Et une fois le PA acquis (phase B), si Cri ou
 *   Do retombe sous le minimum, il n'existe plus aucune rune sûre pour le remonter
 *   (il faudrait une rune ≥ 10 de poids, qui risquerait de refaire sauter le PA) : on
 *   reste alors bloqué avec un essai perdu. Construire les lignes sûres en premier
 *   élimine presque totalement ce blocage (essais simulés : taux de réussite ×8 à
 *   ×80 selon l'état de départ). Une fois toutes les lignes sûres au minimum, la
 *   priorité redevient Cri, puis Do, puis Ga Pa, tenté dès que possible quelle que
 *   soit sa probabilité de réussite (elle ne dépassera jamais 50% par construction :
 *   c'est attendu, pas une raison de ne pas essayer).
 * - Phase B (PA == 1) : uniquement des runes de poids < 10, dans l'ordre de priorité
 *   Ré Per Air, Agilité, Puissance, Vitalité, Ré Terre, Ré Feu. Jamais Cri/Do/Ga Pa.
 *   Si Cri ou Do est malgré tout retombé sous le minimum visé (perte collatérale
 *   après l'obtention du PA), impossible d'y remédier sans risquer le PA : le coach
 *   prévient plutôt que de conseiller une pose.
 *
 * `goals` permet de remplacer les minimums par défaut (config.ts) par des minimums
 * choisis par l'utilisateur, par exemple pour viser un anneau plus fort que le
 * minimum "jouable".
 */
export function getCoachAdvice(state: ObjectState, goals?: GoalOverrides): CoachAdvice {
  if (state.values.pa === 0) {
    for (const line of PHASE_B_PRIORITY) {
      if (meetsGoal(state, line, goals)) continue;
      const rune = bestAvailableRune(state, phaseBCandidateRunes(line));
      if (rune) {
        return advise(
          state,
          'A',
          rune,
          `Stabilisation : ${LINES[line].label} sous le minimum visé — on la remonte avant de retoucher Cri/Do, pour que leurs pertes se dispersent sur plus de lignes au lieu de se renvoyer la balle entre elles deux.`
        );
      }
    }
    if (!meetsGoal(state, 'cri', goals)) {
      return advise(state, 'A', RUNE_BY_ID.cri, 'Critique sous le minimum visé : on le sécurise avant tout.');
    }
    if (!meetsGoal(state, 'do', goals)) {
      return advise(state, 'A', RUNE_BY_ID.do, 'Dommages sous le minimum visé : on le sécurise avant le PA.');
    }
    return advise(state, 'A', RUNE_BY_ID.gaPa, 'Cri et Do atteignent le minimum visé : tente le Ga Pa.');
  }

  // Phase B : le PA est acquis, on ne le remet plus en jeu avec des runes lourdes.
  if (!meetsGoal(state, 'cri', goals) || !meetsGoal(state, 'do', goals)) {
    return advise(
      state,
      'B',
      null,
      'Accepte ou risque le PA : remonter Cri/Do demanderait une rune lourde (poids ≥ 10).'
    );
  }

  for (const line of PHASE_B_PRIORITY) {
    if (meetsGoal(state, line, goals)) continue;
    const rune = bestAvailableRune(state, phaseBCandidateRunes(line));
    if (rune) {
      return advise(state, 'B', rune, `${LINES[line].label} sous le minimum visé : on complète en restant sous 10 de poids.`);
    }
  }

  if (isGoalReached(state, goals)) {
    return advise(state, 'done', null, 'Objectif atteint, arrête-toi.', true);
  }

  return advise(state, 'B', null, 'Plus aucune rune sûre disponible.');
}
