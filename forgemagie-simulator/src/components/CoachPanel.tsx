import type { CoachAdvice, RuneConfig } from '../engine/types';

interface CoachPanelProps {
  advice: CoachAdvice;
  onApply: (rune: RuneConfig) => void;
}

export function CoachPanel({ advice, onApply }: CoachPanelProps) {
  return (
    <div className={`coach-panel coach-phase-${advice.phase}`}>
      <div className="coach-phase-badge">Phase {advice.phase === 'done' ? '✓' : advice.phase}</div>
      <div className="coach-reason">{advice.reason}</div>
      {advice.rune ? (
        <button type="button" className="coach-apply-btn" onClick={() => advice.rune && onApply(advice.rune)}>
          Appliquer : {advice.rune.label} [{advice.rune.shortcut}]
        </button>
      ) : (
        <div className="coach-no-rune">
          {advice.goalReached ? '🏆 Objectif atteint, arrête-toi.' : 'Aucune pose sûre à conseiller.'}
        </div>
      )}
    </div>
  );
}
