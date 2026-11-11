import type { CoachAdvice, RuneConfig } from '../engine/types';

interface CoachPanelProps {
  advice: CoachAdvice;
  /** Omis en mode "Coach en direct" : la pose se fait réellement en jeu, pas dans l'outil. */
  onApply?: (rune: RuneConfig) => void;
}

export function CoachPanel({ advice, onApply }: CoachPanelProps) {
  return (
    <div className={`coach-panel coach-phase-${advice.phase}`}>
      <div className="coach-phase-badge">Phase {advice.phase === 'done' ? '✓' : advice.phase}</div>
      <div className="coach-reason">{advice.reason}</div>
      {advice.rune ? (
        <>
          {advice.p !== null && (
            <div className={`coach-proba ${advice.p >= 0.5 ? 'coach-proba-good' : advice.p < 0.1 ? 'coach-proba-bad' : ''}`}>
              {Math.round(advice.p * 100)}% de réussite critique
            </div>
          )}
          {onApply ? (
            <button type="button" className="coach-apply-btn" onClick={() => advice.rune && onApply(advice.rune)}>
              Appliquer : {advice.rune.label} [{advice.rune.shortcut}]
            </button>
          ) : (
            <div className="coach-apply-btn coach-apply-readonly">
              À poser en jeu : {advice.rune.label} [{advice.rune.shortcut}]
            </div>
          )}
        </>
      ) : (
        <div className="coach-no-rune">
          {advice.goalReached ? '🏆 Objectif atteint, arrête-toi.' : 'Aucune pose sûre à conseiller.'}
        </div>
      )}
    </div>
  );
}
