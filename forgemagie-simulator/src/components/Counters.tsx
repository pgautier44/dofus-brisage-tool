import type { JournalEntry } from '../storage';

export function Counters({ journal }: { journal: JournalEntry[] }) {
  const totalRunesPosed = journal.length;
  const gaPaCount = journal.filter((j) => j.runeLabel === 'Ga Pa' && j.outcome === 'critique').length;
  const echecs = journal.filter((j) => j.outcome === 'echec').length;
  const critiques = journal.filter((j) => j.outcome === 'critique').length;

  return (
    <div className="counters">
      <div className="counter">
        <span className="counter-value">{totalRunesPosed}</span>
        <span className="counter-label">runes posées</span>
      </div>
      <div className="counter">
        <span className="counter-value">{gaPaCount}</span>
        <span className="counter-label">Ga Pa réussies</span>
      </div>
      <div className="counter">
        <span className="counter-value">{critiques}</span>
        <span className="counter-label">critiques</span>
      </div>
      <div className="counter">
        <span className="counter-value">{echecs}</span>
        <span className="counter-label">échecs</span>
      </div>
    </div>
  );
}
