import { MON_ANNEAU_HDV_PRICE_DEFAULT, RUNES } from './engine/config';
import type { GoalOverrides, LineValues, ObjectState, RuneId, RuneOutcome } from './engine/types';

const SESSION_KEY = 'forgemagie:session:v1';
const PRICES_KEY = 'forgemagie:prices:v1';
const HISTORY_KEY = 'forgemagie:history:v1';
const GOALS_KEY = 'forgemagie:goals:v1';

export interface JournalEntry {
  id: string;
  runeLabel: string;
  outcome: RuneOutcome;
  p: number;
  paLost: boolean;
}

export interface PersistedSession {
  state: ObjectState;
  journal: JournalEntry[];
  undoStack: ObjectState[];
}

export interface RunePrices {
  ring: number;
  perRune: Partial<Record<RuneId, number>>;
}

export interface HistoryEntry {
  id: string;
  date: string;
  success: boolean;
  gaPaCount: number;
  totalRunesPosed: number;
  finalValues: LineValues;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible (quota, navigation privée...) : on continue sans persister
  }
}

export function loadSession(): PersistedSession | null {
  return readJson<PersistedSession>(SESSION_KEY);
}

export function saveSession(session: PersistedSession): void {
  writeJson(SESSION_KEY, session);
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function defaultRunePrices(): RunePrices {
  return { ring: MON_ANNEAU_HDV_PRICE_DEFAULT, perRune: Object.fromEntries(RUNES.map((r) => [r.id, 0])) };
}

export function loadRunePrices(): RunePrices {
  const stored = readJson<RunePrices>(PRICES_KEY);
  if (!stored) return defaultRunePrices();
  return { ring: stored.ring ?? MON_ANNEAU_HDV_PRICE_DEFAULT, perRune: { ...defaultRunePrices().perRune, ...stored.perRune } };
}

export function saveRunePrices(prices: RunePrices): void {
  writeJson(PRICES_KEY, prices);
}

export function loadHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(HISTORY_KEY) ?? [];
}

export function appendHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const history = [entry, ...loadHistory()];
  writeJson(HISTORY_KEY, history);
  return history;
}

export function clearHistory(): void {
  writeJson(HISTORY_KEY, []);
}

export function loadGoals(): GoalOverrides {
  return readJson<GoalOverrides>(GOALS_KEY) ?? {};
}

export function saveGoals(goals: GoalOverrides): void {
  writeJson(GOALS_KEY, goals);
}
