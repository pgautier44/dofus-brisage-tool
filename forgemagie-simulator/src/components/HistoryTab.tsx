import { useState } from 'react';
import { clearHistory, loadHistory, type HistoryEntry } from '../storage';

export function HistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  function onClear() {
    clearHistory();
    setHistory([]);
  }

  return (
    <div className="history-tab">
      <div className="history-header">
        <h3>Historique des essais terminés</h3>
        <button type="button" className="danger" onClick={onClear} disabled={history.length === 0}>
          Effacer l'historique
        </button>
      </div>
      {history.length === 0 ? (
        <div className="history-empty">Aucun essai terminé pour l'instant.</div>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Résultat</th>
              <th>Ga Pa</th>
              <th>Runes posées</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.date).toLocaleString('fr-FR')}</td>
                <td>{entry.success ? '✅ Réussi' : '❌ Abandonné'}</td>
                <td>{entry.gaPaCount}</td>
                <td>{entry.totalRunesPosed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
