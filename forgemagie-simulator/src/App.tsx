import { useState } from 'react';
import { CoachPanel } from './components/CoachPanel';
import { Controls } from './components/Controls';
import { Counters } from './components/Counters';
import { EstimationTab } from './components/EstimationTab';
import { Gauges } from './components/Gauges';
import { HistoryTab } from './components/HistoryTab';
import { Journal } from './components/Journal';
import { RuneGrid } from './components/RuneGrid';
import { useSimulatorSession } from './hooks/useSimulatorSession';

type Tab = 'entrainement' | 'estimation' | 'historique';

export function App() {
  const [tab, setTab] = useState<Tab>('entrainement');
  const session = useSimulatorSession();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Simulateur de forgemagie — Exo PA</h1>
        <p className="app-subtitle">Anneau Cérémonial du Seigneur des Rats (niveau 131)</p>
        <nav className="tabs">
          <button className={tab === 'entrainement' ? 'active' : ''} onClick={() => setTab('entrainement')}>
            Entraînement
          </button>
          <button className={tab === 'estimation' ? 'active' : ''} onClick={() => setTab('estimation')}>
            Estimation
          </button>
          <button className={tab === 'historique' ? 'active' : ''} onClick={() => setTab('historique')}>
            Historique
          </button>
        </nav>
      </header>

      <main>
        {tab === 'entrainement' && (
          <div className="training-layout">
            <section className="sheet-column">
              <Gauges state={session.state} />
              <Controls
                onMonAnneauHdv={session.useMonAnneauHdv}
                onRandomRing={session.useRandomRing}
                onUndo={session.undo}
                onReset={session.reset}
                canUndo={session.canUndo}
              />
            </section>

            <section className="action-column">
              <CoachPanel advice={session.advice} onApply={session.poseRune} />
              <RuneGrid state={session.state} recommendedRuneId={session.advice.rune?.id ?? null} onPose={session.poseRune} />
              <Counters journal={session.journal} />
            </section>

            <section className="journal-column">
              <h3>Journal</h3>
              <Journal entries={session.journal} />
            </section>
          </div>
        )}

        {tab === 'estimation' && <EstimationTab currentState={session.state} />}

        {tab === 'historique' && <HistoryTab />}
      </main>
    </div>
  );
}
