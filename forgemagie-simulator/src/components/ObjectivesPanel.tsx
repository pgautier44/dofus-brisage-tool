import { LINES, LINE_ORDER } from '../engine/config';
import { effectiveMinOk } from '../engine/state';
import type { GoalOverrides, LineKey } from '../engine/types';

interface ObjectivesPanelProps {
  goals: GoalOverrides;
  onChange: (line: LineKey, value: number | null) => void;
  onReset: () => void;
}

const EDITABLE_LINES: LineKey[] = LINE_ORDER.filter((k) => k !== 'pa');

export function ObjectivesPanel({ goals, onChange, onReset }: ObjectivesPanelProps) {
  return (
    <details className="objectives-panel">
      <summary>Objectifs (minimums visés)</summary>
      <p className="objectives-hint">
        Le coach ne conseille le Ga Pa que lorsque Cri et Do atteignent ces minimums — le reste de
        l'essai (phase B) vise aussi ces minimums. Laisser vide = pas d'exigence sur cette ligne.
      </p>
      <div className="objectives-grid">
        {EDITABLE_LINES.map((line) => {
          const config = LINES[line];
          const value = effectiveMinOk(line, goals);
          return (
            <div className="objective-row" key={line}>
              <label>{config.label}</label>
              <input
                type="number"
                placeholder="—"
                value={value ?? ''}
                min={config.min}
                max={config.max}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange(line, raw === '' ? null : Number(raw));
                }}
              />
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onReset}>
        Réinitialiser les objectifs par défaut
      </button>
    </details>
  );
}
