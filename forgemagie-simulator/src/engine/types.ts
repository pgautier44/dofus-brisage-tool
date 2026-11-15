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

/**
 * Minimums visés, définis par l'utilisateur, qui remplacent le minOk par défaut
 * d'une ligne (config.ts) quand la ligne est présente dans l'objet. `null` signifie
 * explicitement "pas d'exigence sur cette ligne". Une ligne absente de cet objet
 * garde le minOk par défaut.
 */
export type GoalOverrides = Partial<Record<LineKey, number | null>>;

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

/**
 * - 'standard' : phase A fait Cri puis Do puis tente le Ga Pa dès que possible (le plus
 *   léger possible au moment du Ga Pa, donc la meilleure probabilité pour CE tirage-là).
 * - 'stabilize-first' : phase A construit d'abord toutes les lignes "sûres" (poids < 10 :
 *   Ré Per Air, Agilité, Puissance, Vitalité, Ré Terre, Ré Feu) avant de toucher à
 *   Cri/Do/Ga Pa. Objectif : une fois Cri ou Do touché par une perte, le tirage au sort de
 *   la ligne qui encaisse une perte a beaucoup plus de lignes non nulles où atterrir
 *   plutôt que de se concentrer sur l'autre des deux (Cri <-> Do qui se renvoient la perte
 *   en boucle quand ce sont les deux seules lignes non nulles restantes). Coûte un poids
 *   plus élevé au moment du Ga Pa (donc une probabilité un peu plus faible pour CE
 *   tirage), mais vise moins de reprises ratées sur Cri/Do au global.
 */
export type CoachStrategy = 'standard' | 'stabilize-first';

export interface CoachAdvice {
  phase: CoachPhase;
  /** null si aucune rune à conseiller (ex: "Accepte ou risque le PA", ou objectif atteint) */
  rune: RuneConfig | null;
  reason: string;
  /** probabilité de succès critique de la rune conseillée ; null si rune est null */
  p: number | null;
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
