import { useSyncExternalStore } from 'react';
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

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

/** Tiny observable store with localStorage persistence. */
function createStore<T>(key: string, initial: T, merge?: (stored: T) => T) {
  let value: T = merge ? merge(load(key, initial)) : load(key, initial);
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

export const settingsStore = createStore<Settings>(KEYS.settings, defaultSettings, (s) => ({
  ...defaultSettings,
  ...s,
}));
export const presetsStore = createStore<Preset[]>(KEYS.presets, []);
export const historyStore = createStore<HistoryEntry[]>(KEYS.history, []);
/** Last-used config per mode, so each mode remembers what you set. */
export const lastConfigStore = createStore<Partial<Record<Mode, WorkoutConfig>>>(KEYS.last, {});

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

export function deleteHistory(id: string) {
  historyStore.set((list) => list.filter((h) => h.id !== id));
}

export function clearHistory() {
  historyStore.set([]);
}

export function rememberConfig(config: WorkoutConfig) {
  lastConfigStore.set((m) => ({ ...m, [config.mode]: config }));
}
