import { LINES, RUNE_BY_ID, RUNES } from './config';
import { isRuneAvailable } from './caps';
import { isGoalReached } from './state';
import type { CoachAdvice, LineKey, ObjectState, RuneConfig } from './types';

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

/**
 * Conseil du coach, en deux phases :
 * - Phase A (PA == 0) : priorité Cri (si < 4), sinon Do (si < 5), sinon Ga Pa.
 * - Phase B (PA == 1) : uniquement des runes de poids < 10, dans l'ordre de priorité
 *   Ré Per Air, Agilité, Puissance, Vitalité, Ré Terre, Ré Feu. Jamais Cri/Do/Ga Pa.
 *   Si Cri ou Do est retombé sous son minimum, impossible d'y remédier sans risquer le
 *   PA (ces runes pèsent >= 10) : le coach prévient plutôt que de conseiller une pose.
 */
export function getCoachAdvice(state: ObjectState): CoachAdvice {
  if (state.values.pa === 0) {
    if (state.values.cri < LINES.cri.minOk!) {
      return { phase: 'A', rune: RUNE_BY_ID.cri, reason: 'Critique sous le minimum : on sécurise le Cri avant tout.', goalReached: false };
    }
    if (state.values.do < LINES.do.minOk!) {
      return { phase: 'A', rune: RUNE_BY_ID.do, reason: 'Dommages sous le minimum : on sécurise le Do avant le PA.', goalReached: false };
    }
    return { phase: 'A', rune: RUNE_BY_ID.gaPa, reason: 'Cri et Do sont bons : on tente le Ga Pa.', goalReached: false };
  }

  // Phase B : le PA est acquis, on ne le remet plus en jeu avec des runes lourdes.
  if (state.values.cri < LINES.cri.minOk! || state.values.do < LINES.do.minOk!) {
    return {
      phase: 'B',
      rune: null,
      reason: 'Accepte ou risque le PA : remonter Cri/Do demanderait une rune lourde (poids ≥ 10).',
      goalReached: false,
    };
  }

  for (const line of PHASE_B_PRIORITY) {
    const minOk = LINES[line].minOk;
    if (minOk === null) continue;
    if (state.values[line] >= minOk) continue;
    const rune = bestAvailableRune(state, phaseBCandidateRunes(line));
    if (rune) {
      return { phase: 'B', rune, reason: `${LINES[line].label} sous le minimum : on complète en restant sous 10 de poids.`, goalReached: false };
    }
  }

  if (isGoalReached(state)) {
    return { phase: 'done', rune: null, reason: 'Objectif atteint, arrête-toi.', goalReached: true };
  }

  return { phase: 'B', rune: null, reason: 'Plus aucune rune sûre disponible.', goalReached: false };
}
