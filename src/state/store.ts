import { useSyncExternalStore } from 'react';
import { MODES } from '../engine/modes';
import { normalizeConfig } from '../engine/normalize';
import type { Mode, WorkoutConfig } from '../engine/types';

// ------------------------------------------------------------------ settings

export interface Settings {
  /** "Get ready" lead-in, seconds (0 = off). */
  prepSec: number;
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** Spoken announcements ("Work", "Rest", "Halfway", "10 seconds"). */
  voice: boolean;
  vibration: boolean;
  /** Keep the screen awake while a timer runs. */
  keepAwake: boolean;
  /** Beep at 3-2-1 before each segment ends. */
  countdownBeeps: boolean;
  /** Announce halfway / 10 seconds / minute marks. */
  milestoneCues: boolean;
  /** Show tenths of a second on count-up timers. */
  showTenths: boolean;
  /** AMRAP & countdowns: show time remaining (true) or elapsed (false). */
  countDownDisplay: boolean;
  theme: 'system' | 'dark' | 'light';
  /** Flash the full screen colour on segment changes. */
  flashOnChange: boolean;
}

export const defaultSettings: Settings = {
  prepSec: 10,
  sound: true,
  volume: 0.8,
  voice: true,
  vibration: true,
  keepAwake: true,
  countdownBeeps: true,
  milestoneCues: true,
  showTenths: true,
  countDownDisplay: true,
  theme: 'system',
  flashOnChange: true,
};

// ------------------------------------------------------------------ presets & history

export interface Preset {
  id: string;
  name: string;
  config: WorkoutConfig;
  /** Built-in presets can't be deleted. */
  builtIn?: boolean;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  name: string;
  mode: Mode;
  config: WorkoutConfig;
  startedAt: number;
  /** Workout time (excl. prep), ms. */
  durationMs: number;
  /** True if the whole plan ran to its end (vs. stopped early). */
  completed: boolean;
  rounds: number;
  /** Round split times (workout elapsed ms of each round tap). */
  roundTimesMs: number[];
  laps: { atMs: number; splitMs: number }[];
  note?: string;
}

// ------------------------------------------------------------------ persistence

const KEYS = {
  settings: 'pulse.settings.v1',
  presets: 'pulse.presets.v1',
  history: 'pulse.history.v1',
  last: 'pulse.lastConfigs.v1',
} as const;

function load(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ validation
// Stored data may be corrupted or written by an older version of the app.
// Everything is validated on load so a bad value can never crash a screen.

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const THEMES: Settings['theme'][] = ['system', 'dark', 'light'];

export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...defaultSettings };
  if (!isObj(raw)) return out;
  const o = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {
    const v = raw[key];
    if (typeof v === typeof defaultSettings[key] && (typeof v !== 'number' || Number.isFinite(v))) o[key] = v;
  }
  out.prepSec = Math.min(600, Math.max(0, Math.round(out.prepSec)));
  out.volume = Math.min(1, Math.max(0, out.volume));
  if (!THEMES.includes(out.theme)) out.theme = defaultSettings.theme;
  return out;
}

export function sanitizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): Preset[] => {
    if (!isObj(p)) return [];
    const config = normalizeConfig(p.config);
    if (!config) return [];
    const name = typeof p.name === 'string' ? p.name : (config.name ?? '');
    return [
      {
        id: typeof p.id === 'string' && p.id ? p.id : uid(),
        name,
        config,
        ...(p.builtIn === true ? { builtIn: true } : {}),
        createdAt: finite(p.createdAt) ? p.createdAt : 0,
      },
    ];
  });
}

export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h): HistoryEntry[] => {
    if (!isObj(h)) return [];
    const config = normalizeConfig(h.config);
    if (!config) return [];
    const laps = Array.isArray(h.laps)
      ? h.laps.filter((l): l is { atMs: number; splitMs: number } => isObj(l) && finite(l.atMs) && finite(l.splitMs))
      : [];
    const entry: HistoryEntry = {
      id: typeof h.id === 'string' && h.id ? h.id : uid(),
      name: typeof h.name === 'string' ? h.name : '',
      mode: config.mode,
      config,
      startedAt: finite(h.startedAt) ? h.startedAt : 0,
      durationMs: finite(h.durationMs) ? Math.max(0, h.durationMs) : 0,
      completed: h.completed === true,
      rounds: finite(h.rounds) ? Math.max(0, Math.round(h.rounds)) : 0,
      roundTimesMs: Array.isArray(h.roundTimesMs) ? h.roundTimesMs.filter(finite) : [],
      laps: laps.map((l) => ({ atMs: l.atMs, splitMs: l.splitMs })),
    };
    if (typeof h.note === 'string') entry.note = h.note;
    return [entry];
  });
}

export function sanitizeLastConfigs(raw: unknown): Partial<Record<Mode, WorkoutConfig>> {
  const out: Partial<Record<Mode, WorkoutConfig>> = {};
  if (!isObj(raw)) return out;
  for (const { mode } of MODES) {
    const c = normalizeConfig(raw[mode]);
    if (c && c.mode === mode) out[mode] = c;
  }
  return out;
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

/** Tiny observable store with localStorage persistence. */
function createStore<T>(key: string, sanitize: (stored: unknown) => T) {
  let value: T;
  try {
    value = sanitize(load(key));
  } catch {
    value = sanitize(undefined);
  }
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      save(key, value);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const settingsStore = createStore<Settings>(KEYS.settings, sanitizeSettings);
export const presetsStore = createStore<Preset[]>(KEYS.presets, sanitizePresets);
export const historyStore = createStore<HistoryEntry[]>(KEYS.history, sanitizeHistory);
/** Last-used config per mode, so each mode remembers what you set. */
export const lastConfigStore = createStore<Partial<Record<Mode, WorkoutConfig>>>(KEYS.last, sanitizeLastConfigs);

type Store<T> = { get: () => T; subscribe: (l: () => void) => () => void };

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const useSettings = () => useStore(settingsStore);
export const usePresets = () => useStore(presetsStore);
export const useHistory = () => useStore(historyStore);

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...patch }));
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function savePreset(name: string, config: WorkoutConfig): Preset {
  const p: Preset = { id: uid(), name, config: { ...config, name }, createdAt: Date.now() };
  presetsStore.set((list) => [p, ...list]);
  return p;
}

export function deletePreset(id: string) {
  presetsStore.set((list) => list.filter((p) => p.id !== id));
}

export function addHistory(entry: Omit<HistoryEntry, 'id'>) {
  historyStore.set((list) => [{ ...entry, id: uid() }, ...list].slice(0, 500));
}

/**
 * Insert a history entry, or update it in place if `id` is already saved.
 * Lets the run screen checkpoint a session (e.g. when the page is hidden)
 * and later overwrite that checkpoint with the final result. Returns the id.
 */
export function saveHistory(id: string | null, entry: Omit<HistoryEntry, 'id'>): string {
  const key = id ?? uid();
  historyStore.set((list) => {
    const i = list.findIndex((h) => h.id === key);
    if (i < 0) return [{ ...entry, id: key }, ...list].slice(0, 500);
    const next = list.slice();
    next[i] = { ...list[i], ...entry, id: key };
    return next;
  });
  return key;
}

export function deleteHistory(id: string) {
  historyStore.set((list) => list.filter((h) => h.id !== id));
}

export function clearHistory() {
  historyStore.set([]);
}

export function rememberConfig(config: WorkoutConfig) {
  lastConfigStore.set((m) => ({ ...m, [config.mode]: config }));
}
