import { LINES, LINE_ORDER, PUITS_TARGET, WMAX } from '../engine/config';
import { lineCap } from '../engine/caps';
import { currentWeight, effectiveMinOk } from '../engine/state';
import type { GoalOverrides, ObjectState } from '../engine/types';

const NON_PA_LINES = LINE_ORDER.filter((k) => k !== 'pa');

export function Gauges({ state, goals }: { state: ObjectState; goals?: GoalOverrides }) {
  const weight = currentWeight(state);
  const hasPa = state.values.pa > 0;

  const lineStatuses = NON_PA_LINES.map((key) => {
    const minOk = effectiveMinOk(key, goals);
    return minOk === null || state.values[key] >= minOk;
  });
  const metCount = lineStatuses.filter(Boolean).length;

  return (
    <div className="gauges">
      <div className="gauges-header">
        <h3>Ton anneau actuel</h3>
        <p className="objectives-hint">
          Objectif : obtenir le PA (exo), puis amener chaque ligne à son minimum visé (✓). Le ○ gris
          indique une ligne pas encore au niveau — pas grave tant que ce n'est pas une des lignes
          obligatoires.
        </p>
      </div>

      <div className={`pa-status ${hasPa ? 'pa-status-done' : 'pa-status-pending'}`}>
        <span className="pa-status-icon">{hasPa ? '✅' : '❌'}</span>
        <span>PA (exo) : {hasPa ? 'obtenu' : 'pas encore obtenu — priorité n°1'}</span>
      </div>

      <div className="gauges-progress">
        {metCount} / {lineStatuses.length} lignes au minimum visé
      </div>

      {NON_PA_LINES.map((key) => {
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
              <span className="gauge-name">
                <span className="gauge-status-icon">{ok ? '✓' : '○'}</span> {line.label}
              </span>
              <span className="gauge-value">
                {value}
                {minOk !== null && <span className="gauge-target"> · objectif {minOk}</span>}
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
