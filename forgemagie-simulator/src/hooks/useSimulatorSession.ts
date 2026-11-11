import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyRune } from '../engine/applyRune';
import { getCoachAdvice } from '../engine/coach';
import { MON_ANNEAU_HDV_VALUES, randomAnneauValues } from '../engine/config';
import { mathRandomRng } from '../engine/rng';
import { cloneState, isGoalReached } from '../engine/state';
import type { CoachAdvice, LineValues, ObjectState, RuneConfig } from '../engine/types';
import {
  JournalEntry,
  appendHistoryEntry,
  clearSession,
  loadSession,
  saveSession,
} from '../storage';

function makeInitialState(values: LineValues = MON_ANNEAU_HDV_VALUES): ObjectState {
  return { values: { ...values }, puits: 0 };
}

let journalIdCounter = 0;
function nextId(prefix: string): string {
  journalIdCounter += 1;
  return `${prefix}_${Date.now()}_${journalIdCounter}`;
}

export function useSimulatorSession() {
  const stored = loadSession();
  const [state, setState] = useState<ObjectState>(() => stored?.state ?? makeInitialState());
  const [journal, setJournal] = useState<JournalEntry[]>(() => stored?.journal ?? []);
  const [undoStack, setUndoStack] = useState<ObjectState[]>(() => stored?.undoStack ?? []);
  const [loggedGoal, setLoggedGoal] = useState(false);

  useEffect(() => {
    saveSession({ state, journal, undoStack });
  }, [state, journal, undoStack]);

  const advice: CoachAdvice = useMemo(() => getCoachAdvice(state), [state]);
  const goalReached = useMemo(() => isGoalReached(state), [state]);

  const poseRune = useCallback(
    (rune: RuneConfig) => {
      setUndoStack((stack) => [...stack, cloneState(state)]);
      const result = applyRune(state, rune, mathRandomRng);
      setState(result.after);
      setJournal((j) =>
        [
          {
            id: nextId('j'),
            runeLabel: rune.label,
            outcome: result.outcome,
            p: result.p,
            paLost: result.paLost,
          },
          ...j,
        ].slice(0, 300)
      );
    },
    [state]
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setState(prev);
      setJournal((j) => j.slice(1));
      return stack.slice(0, -1);
    });
  }, []);

  const resetTo = useCallback((values: LineValues) => {
    setState(makeInitialState(values));
    setJournal([]);
    setUndoStack([]);
    setLoggedGoal(false);
    clearSession();
  }, []);

  const useMonAnneauHdv = useCallback(() => resetTo(MON_ANNEAU_HDV_VALUES), [resetTo]);
  const useRandomRing = useCallback(() => resetTo(randomAnneauValues(mathRandomRng)), [resetTo]);

  useEffect(() => {
    if (goalReached && !loggedGoal) {
      setLoggedGoal(true);
      const gaPaCount = journal.filter((j) => j.runeLabel === 'Ga Pa' && j.outcome === 'critique').length;
      appendHistoryEntry({
        id: nextId('h'),
        date: new Date().toISOString(),
        success: true,
        gaPaCount,
        totalRunesPosed: journal.length,
        finalValues: state.values,
      });
    }
  }, [goalReached, loggedGoal, journal, state.values]);

  return {
    state,
    advice,
    goalReached,
    journal,
    canUndo: undoStack.length > 0,
    poseRune,
    undo,
    reset: () => resetTo(MON_ANNEAU_HDV_VALUES),
    useMonAnneauHdv,
    useRandomRing,
  };
}
