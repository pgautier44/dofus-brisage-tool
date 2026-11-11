import { LINES, LINE_ORDER, PUITS_TARGET, WMAX } from '../engine/config';
import { lineCap } from '../engine/caps';
import { currentWeight, effectiveMinOk } from '../engine/state';
import type { GoalOverrides, ObjectState } from '../engine/types';

export function Gauges({ state, goals }: { state: ObjectState; goals?: GoalOverrides }) {
  const weight = currentWeight(state);

  return (
    <div className="gauges">
      {LINE_ORDER.map((key) => {
        const line = LINES[key];
        const cap = lineCap(line);
        const value = state.values[key];
        const minOk = effectiveMinOk(key, goals);
        const span = Math.max(cap, 1);
        const pct = Math.min(100, (value / span) * 100);
        const minOkPct = minOk !== null ? Math.min(100, (minOk / span) * 100) : null;
        const maxPct = Math.min(100, (line.max / span) * 100);
        const ok = minOk === null || value >= minOk;
        return (
          <div className={`gauge ${ok ? 'gauge-ok' : 'gauge-warn'}`} key={key}>
            <div className="gauge-label">
              <span>{line.label}</span>
              <span className="gauge-value">
                {value}
                {minOk !== null ? ` / ${minOk}` : ''}
              </span>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${pct}%` }} />
              {minOkPct !== null && (
                <div className="gauge-marker gauge-marker-minok" style={{ left: `${minOkPct}%` }} title="minimum visé" />
              )}
              <div className="gauge-marker gauge-marker-max" style={{ left: `${maxPct}%` }} title="max normal (overmax au-delà)" />
            </div>
          </div>
        );
      })}

      <div className="gauge gauge-aux">
        <div className="gauge-label">
          <span>Poids actuel</span>
          <span className="gauge-value">
            {weight.toFixed(0)} / {WMAX}
          </span>
        </div>
        <div className="gauge-track">
          <div className="gauge-fill gauge-fill-weight" style={{ width: `${Math.min(100, (weight / WMAX) * 100)}%` }} />
        </div>
      </div>

      <div className="gauge gauge-aux">
        <div className="gauge-label">
          <span>Puits</span>
          <span className="gauge-value">
            {state.puits.toFixed(1)} / {PUITS_TARGET}
          </span>
        </div>
        <div className="gauge-track">
          <div
            className="gauge-fill gauge-fill-puits"
            style={{ width: `${Math.min(100, (state.puits / PUITS_TARGET) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
