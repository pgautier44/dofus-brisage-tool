import { useEffect, useMemo, useRef, useState } from 'react';
import { RUNES } from '../engine/config';
import type { ObjectState } from '../engine/types';
import { loadRunePrices, saveRunePrices, type RunePrices } from '../storage';
import type { SimulationAggregate, SimulationRequest } from '../worker/simulationWorker';

export function EstimationTab({ currentState }: { currentState: ObjectState }) {
  const [prices, setPrices] = useState<RunePrices>(() => loadRunePrices());
  const [trials, setTrials] = useState(1000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationAggregate | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    saveRunePrices(prices);
  }, [prices]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  function updateRunePrice(id: string, value: number) {
    setPrices((p) => ({ ...p, perRune: { ...p.perRune, [id]: value } }));
  }

  function runSimulation() {
    setRunning(true);
    setResult(null);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../worker/simulationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SimulationAggregate>) => {
      setResult(event.data);
      setRunning(false);
      worker.terminate();
    };
    const request: SimulationRequest = {
      initialValues: currentState.values,
      initialPuits: currentState.puits,
      trials,
      seed: Math.floor(Math.random() * 2 ** 31),
      pricePerRune: prices.perRune,
    };
    worker.postMessage(request);
  }

  const totalRingCost = prices.ring;

  const histogramMax = useMemo(() => (result ? Math.max(1, ...result.gaPaHistogram) : 1), [result]);

  return (
    <div className="estimation-tab">
      <section className="prices-section">
        <h3>Prix (kamas)</h3>
        <div className="price-row">
          <label>Anneau (HDV)</label>
          <input
            type="number"
            min={0}
            value={totalRingCost}
            onChange={(e) => setPrices((p) => ({ ...p, ring: Number(e.target.value) }))}
          />
        </div>
        <div className="price-grid">
          {RUNES.map((rune) => (
            <div className="price-row" key={rune.id}>
              <label>{rune.label}</label>
              <input
                type="number"
                min={0}
                value={prices.perRune[rune.id] ?? 0}
                onChange={(e) => updateRunePrice(rune.id, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="simulate-section">
        <label>
          Nombre d'essais
          <input
            type="number"
            min={10}
            max={20000}
            value={trials}
            onChange={(e) => setTrials(Math.max(10, Number(e.target.value)))}
          />
        </label>
        <button type="button" onClick={runSimulation} disabled={running}>
          {running ? 'Simulation en cours…' : `Simuler ${trials} essais`}
        </button>
      </section>

      {result && (
        <section className="results-section">
          <div className="results-grid">
            <div className="result-card">
              <span className="result-value">{(result.successRate * 100).toFixed(1)}%</span>
              <span className="result-label">taux de réussite</span>
            </div>
            <div className="result-card">
              <span className="result-value">{result.meanGaPaCount.toFixed(2)}</span>
              <span className="result-label">Ga Pa moyennes</span>
            </div>
            <div className="result-card">
              <span className="result-value">{result.medianGaPaCount}</span>
              <span className="result-label">Ga Pa médiane</span>
            </div>
            <div className="result-card">
              <span className="result-value">{Math.round(result.meanCost).toLocaleString('fr-FR')}</span>
              <span className="result-label">coût moyen (kamas)</span>
            </div>
            <div className="result-card">
              <span className="result-value">{Math.round(result.p80Cost).toLocaleString('fr-FR')}</span>
              <span className="result-label">coût au 80e percentile</span>
            </div>
            <div className="result-card">
              <span className="result-value">{(result.paLostInPhaseBRate * 100).toFixed(1)}%</span>
              <span className="result-label">perte de PA en phase B</span>
            </div>
            <div className="result-card">
              <span className="result-value">{(result.stoppedByRuneLimitRate * 100).toFixed(1)}%</span>
              <span className="result-label">arrêtés à la limite de 500 runes</span>
            </div>
          </div>

          <h4>Runes posées en moyenne</h4>
          <ul className="rune-means">
            {RUNES.map((rune) => (
              <li key={rune.id}>
                <span>{rune.label}</span>
                <span>{(result.meanRuneCounts[rune.id] ?? 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <h4>Histogramme du nombre de Ga Pa par essai</h4>
          <div className="histogram">
            {result.gaPaHistogram.map((count, idx) => (
              <div className="histogram-bar-wrap" key={idx}>
                <div
                  className="histogram-bar"
                  style={{ height: `${(count / histogramMax) * 100}%` }}
                  title={`${count} essai(s) avec ${idx} Ga Pa`}
                />
                <span className="histogram-x">{idx}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
