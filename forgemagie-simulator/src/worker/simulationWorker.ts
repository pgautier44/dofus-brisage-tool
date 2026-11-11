import { createSeededRng } from '../engine/rng';
import { simulateTrial } from '../engine/simulate';
import type { GoalOverrides, LineValues, ObjectState, RuneId, TrialSummary } from '../engine/types';

export interface SimulationRequest {
  initialValues: LineValues;
  initialPuits: number;
  trials: number;
  seed: number;
  pricePerRune: Partial<Record<RuneId, number>>;
  goals?: GoalOverrides;
}

export interface SimulationAggregate {
  trials: number;
  successRate: number;
  meanGaPaCount: number;
  medianGaPaCount: number;
  meanRuneCounts: Partial<Record<RuneId, number>>;
  meanCost: number;
  p80Cost: number;
  paLostInPhaseBRate: number;
  stoppedByRuneLimitRate: number;
  /** histogramme du nombre de Ga Pa posées par essai : index = nombre de Ga Pa, valeur = nb d'essais */
  gaPaHistogram: number[];
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function runSimulation(req: SimulationRequest): SimulationAggregate {
  const rng = createSeededRng(req.seed);
  const initialState: ObjectState = { values: { ...req.initialValues }, puits: req.initialPuits };

  const results: TrialSummary[] = [];
  for (let i = 0; i < req.trials; i++) {
    results.push(simulateTrial(initialState, { rng, pricePerRune: req.pricePerRune, goals: req.goals }));
  }

  const successes = results.filter((r) => r.success).length;
  const gaPaCounts = results.map((r) => r.gaPaCount).sort((a, b) => a - b);
  const costs = results.map((r) => r.cost).sort((a, b) => a - b);

  const meanRuneCounts: Partial<Record<RuneId, number>> = {};
  const runeTotals: Partial<Record<RuneId, number>> = {};
  for (const r of results) {
    for (const [id, count] of Object.entries(r.runeCounts)) {
      runeTotals[id as RuneId] = (runeTotals[id as RuneId] ?? 0) + (count ?? 0);
    }
  }
  for (const [id, total] of Object.entries(runeTotals)) {
    meanRuneCounts[id as RuneId] = (total ?? 0) / req.trials;
  }

  const maxGaPa = gaPaCounts.length > 0 ? gaPaCounts[gaPaCounts.length - 1] : 0;
  const gaPaHistogram = new Array(maxGaPa + 1).fill(0);
  for (const c of gaPaCounts) gaPaHistogram[c] += 1;

  return {
    trials: req.trials,
    successRate: successes / req.trials,
    meanGaPaCount: gaPaCounts.reduce((a, b) => a + b, 0) / req.trials,
    medianGaPaCount: median(gaPaCounts),
    meanRuneCounts,
    meanCost: costs.reduce((a, b) => a + b, 0) / req.trials,
    p80Cost: percentile(costs, 80),
    paLostInPhaseBRate: results.filter((r) => r.paLostInPhaseB).length / req.trials,
    stoppedByRuneLimitRate: results.filter((r) => r.stoppedByRuneLimit).length / req.trials,
    gaPaHistogram,
  };
}

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const result = runSimulation(event.data);
  (self as unknown as Worker).postMessage(result);
};
