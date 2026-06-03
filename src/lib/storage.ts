export type Category = "JH" | "SeB" | "MJ_SOCIAL" | "MJ_PERSONAL" | "SAFAI" | "HEALTH" | "UNCATEGORIZED";

export interface Task {
  id: string;
  title: string;
  xp: number;
  done: boolean;
  createdAt: number;
  completedAt?: number;
  category?: Category;
}

export type WorkPhase = "idle" | "focus" | "break" | "longBreak";

export interface WorkCycleState {
  goal: number;
  phase: WorkPhase;
  phaseStartedAt: number | null;
  phaseDurationMs: number;
  pausedRemainingMs: number | null;
  cyclesSinceLongBreak: number;
  currentLabel: string;
  lastGoalCelebratedDate: string | null;
  muted: boolean;
}

export interface AppState {
  tasks: Task[];
  xp: number;
  level: number;
  streak: number;
  lastCompletionDate: string | null; // YYYY-MM-DD
  totalCompleted: number;
  workCycle: WorkCycleState;
}

const KEY = "synthwave-productivity-v1";

export const defaultWorkCycle: WorkCycleState = {
  goal: 4,
  phase: "idle",
  phaseStartedAt: null,
  phaseDurationMs: 20 * 60 * 1000,
  pausedRemainingMs: null,
  cyclesSinceLongBreak: 0,
  currentLabel: "",
  lastGoalCelebratedDate: null,
  muted: false,
};

export const defaultState: AppState = {
  tasks: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastCompletionDate: null,
  totalCompleted: 0,
  workCycle: defaultWorkCycle,
};

export const WORK_CYCLE_TITLE = "Work Cycle (20 min)";
export const FOCUS_MS = 20 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;
export const LONG_BREAK_MS = 15 * 60 * 1000;


export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      workCycle: { ...defaultWorkCycle, ...(parsed.workCycle ?? {}) },
    };
  } catch {
    return defaultState;
  }
}

export function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function xpForLevel(level: number) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr() {
  return localDateStr(new Date());
}

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

// ===== Journal (formerly Urge log) =====
export type UrgeAction = "breathing" | "walk" | "water" | "stretch" | "cold-water";

export type JournalEntryType = "urge" | "cycle";

export interface JournalEntry {
  id: string;
  entryType: JournalEntryType;
  startedAt: number;
  endedAt: number;
  reason?: string;
  defeated?: boolean;
  actionsUsed?: UrgeAction[];
  note?: string;
  tasksCompleted?: string[];
}

export type UrgeEntry = JournalEntry;

const JOURNAL_KEY = "youms-journal-v1";

export function loadJournal(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveJournalEntry(entry: JournalEntry) {
  if (typeof window === "undefined") return;
  const all = loadJournal();
  all.push(entry);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(all));
}

export function loadJournalSorted(): JournalEntry[] {
  return loadJournal().sort((a, b) => b.startedAt - a.startedAt);
}

// Aliases for backward compatibility
export const loadUrgeLog = loadJournal;
export const saveUrgeEntry = saveJournalEntry;
export const loadUrgeLogSorted = loadJournalSorted;
