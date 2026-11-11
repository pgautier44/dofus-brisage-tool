import type { JournalEntry } from '../storage';

const OUTCOME_LABEL: Record<JournalEntry['outcome'], string> = {
  critique: 'Critique',
  neutre: 'Neutre',
  echec: 'Échec',
};

export function Journal({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) {
    return <div className="journal journal-empty">Aucune pose pour l'instant.</div>;
  }

  return (
    <ul className="journal">
      {entries.map((entry) => (
        <li key={entry.id} className={`journal-entry journal-${entry.outcome}`}>
          <span className="journal-rune">{entry.runeLabel}</span>
          <span className="journal-outcome">{OUTCOME_LABEL[entry.outcome]}</span>
          <span className="journal-p">p={Math.round(entry.p * 100)}%</span>
          {entry.paLost && <span className="journal-pa-lost">⚠ PA perdu</span>}
        </li>
      ))}
    </ul>
  );
}
