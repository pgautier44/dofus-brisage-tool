export type LineKey =
  | 'pa'
  | 'vi'
  | 'age'
  | 'pui'
  | 'cri'
  | 'do'
  | 'rair'
  | 'rterre'
  | 'rfeu'
  | 'pro';

export interface LineConfig {
  key: LineKey;
  label: string;
  min: number;
  max: number;
  weightPerPoint: number;
  /** null = ligne sacrifiable, pas de minimum requis */
  minOk: number | null;
}

export type RuneId =
  | 'gaPa'
  | 'vi'
  | 'paVi'
  | 'raVi'
  | 'age'
  | 'paAge'
  | 'raAge'
  | 'pui'
  | 'paPui'
  | 'cri'
  | 'do'
  | 'rair'
  | 'rterre'
  | 'rfeu';

export interface RuneConfig {
  id: RuneId;
  label: string;
  line: LineKey;
  gain: number;
  weight: number;
  /** Touche clavier affichée sur le bouton */
  shortcut: string;
}

/** Valeurs des lignes de l'objet (hors "puits", géré à part) */
export type LineValues = Record<LineKey, number>;

export interface ObjectState {
  values: LineValues;
  /** Le "puits" qui absorbe une partie des pertes */
  puits: number;
}

export type RuneOutcome = 'critique' | 'neutre' | 'echec';

export interface LossDetail {
  /** Montant pris directement dans le puits */
  fromPuits: number;
  /** Lignes touchées et nombre de points retirés à chacune */
  linesLost: { line: LineKey; points: number }[];
  /** Reliquat renvoyé dans le puits (perte retirée en points entiers > montant dû) */
  reliquat: number;
}

export interface RuneApplyResult {
  rune: RuneConfig;
  outcome: RuneOutcome;
  /** Probabilité de succès critique calculée avant le tirage */
  p: number;
  tirage: number;
  before: ObjectState;
  after: ObjectState;
  loss: LossDetail | null;
  /** true si cette pose a fait perdre le PA (ligne pa redescendue à 0) */
  paLost: boolean;
}

/** RNG injectable : fonction retournant un flottant uniforme dans [0, 1) */
export type Rng = () => number;

export type CoachPhase = 'A' | 'B' | 'done';

export interface CoachAdvice {
  phase: CoachPhase;
  /** null si aucune rune à conseiller (ex: "Accepte ou risque le PA", ou objectif atteint) */
  rune: RuneConfig | null;
  reason: string;
  /** true quand l'objectif est atteint et que l'essai doit s'arrêter */
  goalReached: boolean;
}

export interface TrialSummary {
  success: boolean;
  runeCounts: Partial<Record<RuneId, number>>;
  gaPaCount: number;
  totalRunesPosed: number;
  cost: number;
  finalState: ObjectState;
  paLostInPhaseB: boolean;
  stoppedByRuneLimit: boolean;
}
