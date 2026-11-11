import { useEffect } from 'react';
import { RUNES } from '../engine/config';
import { isRuneAvailable } from '../engine/caps';
import { calcSuccessProbability } from '../engine/probability';
import type { ObjectState, RuneConfig } from '../engine/types';

interface RuneGridProps {
  state: ObjectState;
  recommendedRuneId: string | null;
  onPose: (rune: RuneConfig) => void;
}

export function RuneGrid({ state, recommendedRuneId, onPose }: RuneGridProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const rune = RUNES.find((r) => r.shortcut.toLowerCase() === e.key.toLowerCase());
      if (rune && isRuneAvailable(state, rune)) {
        e.preventDefault();
        onPose(rune);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, onPose]);

  return (
    <div className="rune-grid" role="group" aria-label="Runes disponibles">
      {RUNES.map((rune) => {
        const available = isRuneAvailable(state, rune);
        const recommended = rune.id === recommendedRuneId;
        const lockedReason =
          !available && rune.id === 'gaPa' && state.values.pa > 0
            ? 'PA déjà acquis'
            : !available
              ? 'Plafond atteint'
              : null;
        const p = calcSuccessProbability(state, rune);
        return (
          <button
            key={rune.id}
            type="button"
            className={`rune-btn ${recommended ? 'rune-btn-recommended' : ''}`}
            disabled={!available}
            onClick={() => onPose(rune)}
            title={`${rune.label} — +${rune.gain} (poids ${rune.weight}) [${rune.shortcut}]`}
          >
            <span className="rune-shortcut">{rune.shortcut}</span>
            <span className="rune-name">{rune.label}</span>
            <span className="rune-meta">
              +{rune.gain} · poids {rune.weight}
            </span>
            <span className={`rune-proba ${available && p >= 0.5 ? 'rune-proba-good' : ''}`}>
              {available ? `${Math.round(p * 100)}% de réussite` : lockedReason}
            </span>
          </button>
        );
      })}
    </div>
  );
}
