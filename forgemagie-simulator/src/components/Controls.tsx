interface ControlsProps {
  onMonAnneauHdv: () => void;
  onRandomRing: () => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
}

export function Controls({ onMonAnneauHdv, onRandomRing, onUndo, onReset, canUndo }: ControlsProps) {
  return (
    <div className="controls">
      <button type="button" onClick={onMonAnneauHdv}>
        Mon anneau HDV
      </button>
      <button type="button" onClick={onRandomRing}>
        Anneau au hasard
      </button>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        Annuler
      </button>
      <button type="button" className="danger" onClick={onReset}>
        Réinitialiser
      </button>
    </div>
  );
}
