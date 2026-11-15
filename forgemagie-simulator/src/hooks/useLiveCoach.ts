import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCoachAdvice } from '../engine/coach';
import { MON_ANNEAU_HDV_VALUES } from '../engine/config';
import { isGoalReached } from '../engine/state';
import type { GoalOverrides, LineKey, LineValues, ObjectState } from '../engine/types';

const LIVE_STATE_KEY = 'forgemagie:live-state:v1';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function makeInitialState(): ObjectState {
  return { values: { ...MON_ANNEAU_HDV_VALUES }, puits: 0 };
}

/**
 * État de l'objet réel suivi en mode "Coach en direct" : jamais modifié par une
 * simulation, uniquement par ce que l'utilisateur confirme (lecture d'écran ou
 * saisie manuelle). Indépendant de la session d'entraînement.
 */
export function useLiveCoach(goals: GoalOverrides) {
  const [state, setState] = useState<ObjectState>(() => readJson<ObjectState>(LIVE_STATE_KEY) ?? makeInitialState());

  useEffect(() => {
    writeJson(LIVE_STATE_KEY, state);
  }, [state]);

  const advice = useMemo(() => getCoachAdvice(state, goals), [state, goals]);
  const goalReached = useMemo(() => isGoalReached(state, goals), [state, goals]);

  const setValue = useCallback((line: LineKey, value: number) => {
    setState((s) => ({ ...s, values: { ...s.values, [line]: value } }));
  }, []);

  const setPuits = useCallback((value: number) => {
    setState((s) => ({ ...s, puits: value }));
  }, []);

  const applyReadValues = useCallback((values: Partial<LineValues>, puits?: number) => {
    setState((s) => ({
      values: { ...s.values, ...values },
      puits: puits ?? s.puits,
    }));
  }, []);

  const resetTo = useCallback((values: LineValues = MON_ANNEAU_HDV_VALUES, puits = 0) => {
    setState({ values: { ...values }, puits });
  }, []);

  return { state, advice, goalReached, setValue, setPuits, applyReadValues, resetTo };
}
