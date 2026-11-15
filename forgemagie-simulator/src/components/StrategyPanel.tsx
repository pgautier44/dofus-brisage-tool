import type { CoachStrategy } from '../engine/types';

export function StrategyPanel({
  strategy,
  onChange,
}: {
  strategy: CoachStrategy;
  onChange: (value: CoachStrategy) => void;
}) {
  return (
    <details className="objectives-panel" open>
      <summary>Stratégie du coach</summary>
      <div className="strategy-options">
        <label className="strategy-option">
          <input
            type="radio"
            name="coach-strategy"
            checked={strategy === 'standard'}
            onChange={() => onChange('standard')}
          />
          <div>
            <strong>Standard</strong>
            <p className="objectives-hint">
              Cri puis Do puis Ga Pa dès que possible — le plus léger possible au moment du Ga Pa, donc la
              meilleure probabilité pour ce tirage-là.
            </p>
          </div>
        </label>
        <label className="strategy-option">
          <input
            type="radio"
            name="coach-strategy"
            checked={strategy === 'stabilize-first'}
            onChange={() => onChange('stabilize-first')}
          />
          <div>
            <strong>Stabiliser d'abord</strong>
            <p className="objectives-hint">
              Remonte les autres lignes sûres avant de retoucher Cri/Do : leurs pertes se dispersent sur plus de
              lignes au lieu de se renvoyer la balle entre elles deux. Coûte un peu de poids (donc une
              probabilité un peu plus faible au Ga Pa), mais vise moins de reprises ratées sur Cri/Do.
              Recommandé si ton anneau est très dégradé et que Cri/Do bouclent en boucle.
            </p>
          </div>
        </label>
      </div>
    </details>
  );
}
