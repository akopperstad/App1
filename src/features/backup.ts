/**
 * Backup & restore (JSON) and history export (CSV). Pure functions plus a
 * small file-saving helper that works on web and inside a native WebView.
 */
import { modeInfo } from '../engine/modes';
import {
  historyStore,
  lastConfigStore,
  presetsStore,
  sanitizeHistory,
  sanitizeLastConfigs,
  sanitizePresets,
  sanitizeSettings,
  settingsStore,
  type HistoryEntry,
  type Preset,
  type Settings,
} from '../state/store';
import type { Mode, WorkoutConfig } from '../engine/types';

export const BACKUP_APP = 'pulse-timer';
export const BACKUP_VERSION = 1;
/** Same cap the store applies to history. */
const HISTORY_CAP = 500;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  settings: Settings;
  presets: Preset[];
  history: HistoryEntry[];
  lastConfigs: Partial<Record<Mode, WorkoutConfig>>;
}

export function buildBackup(now = Date.now()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: settingsStore.get(),
    // Built-ins ship with the app; never export them.
    presets: presetsStore.get().filter((p) => !p.builtIn),
    history: historyStore.get(),
    lastConfigs: lastConfigStore.get(),
  };
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `pulse-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/**
 * Parse and validate a backup file's text. Every part goes through the same
 * sanitizers used when loading localStorage, so a hand-edited or corrupted
 * file can never put bad data in the stores. Returns null if it isn't a backup.
 */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.app !== BACKUP_APP) return null;
  if (typeof o.version !== 'number' || o.version < 1 || o.version > BACKUP_VERSION) return null;
  return {
    app: BACKUP_APP,
    version: o.version,
    exportedAt: typeof o.exportedAt === 'number' && Number.isFinite(o.exportedAt) ? o.exportedAt : 0,
    settings: sanitizeSettings(o.settings),
    presets: sanitizePresets(o.presets).filter((p) => !p.builtIn),
    history: sanitizeHistory(o.history),
    lastConfigs: sanitizeLastConfigs(o.lastConfigs),
  };
}

export interface MergePlan {
  presets: Preset[];
  history: HistoryEntry[];
  addedPresets: number;
  addedHistory: number;
}

/**
 * Merge incoming data into the current lists, deduplicating by id (existing
 * entries win). History is kept newest-first and capped like the store.
 */
export function planMerge(
  current: { presets: Preset[]; history: HistoryEntry[] },
  incoming: { presets: Preset[]; history: HistoryEntry[] },
): MergePlan {
  const presetIds = new Set(current.presets.map((p) => p.id));
  const newPresets = incoming.presets.filter((p) => !presetIds.has(p.id) && (presetIds.add(p.id), true));
  const histIds = new Set(current.history.map((h) => h.id));
  const newHistory = incoming.history.filter((h) => !histIds.has(h.id) && (histIds.add(h.id), true));
  const history = [...current.history, ...newHistory].sort((a, b) => b.startedAt - a.startedAt).slice(0, HISTORY_CAP);
  const kept = new Set(history.map((h) => h.id));
  return {
    presets: [...current.presets, ...newPresets],
    history,
    addedPresets: newPresets.length,
    addedHistory: newHistory.filter((h) => kept.has(h.id)).length,
  };
}

/** Apply a parsed backup to the stores. Onboarding is never re-triggered. */
export function applyBackup(b: Backup, opts: { settings: boolean }): MergePlan {
  const plan = planMerge({ presets: presetsStore.get(), history: historyStore.get() }, b);
  presetsStore.set(plan.presets);
  historyStore.set(plan.history);
  lastConfigStore.set((cur) => ({ ...b.lastConfigs, ...cur }));
  if (opts.settings) settingsStore.set({ ...b.settings, onboarded: true });
  return plan;
}

// ------------------------------------------------------------------ CSV

/** Quote a CSV cell; neutralise spreadsheet formula injection (=, +, -, @). */
export function csvCell(v: string | number | boolean): string {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-11-14 07:05" in local time (sorts correctly, spreadsheet-friendly). */
function localDateTime(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "1:02:03" / "12:34" */
function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
}

export const CSV_HEADER = ['Date', 'Name', 'Mode', 'Duration', 'Duration (s)', 'Rounds', 'Completed'];

export function historyToCsv(list: HistoryEntry[]): string {
  const rows = [...list]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((h) => {
      const title = modeInfo(h.mode)?.title ?? h.mode;
      return [
        localDateTime(h.startedAt),
        h.name || title,
        title,
        clock(h.durationMs),
        Math.round(h.durationMs / 1000),
        h.rounds,
        h.completed ? 'yes' : 'no',
      ];
    });
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function csvFileName(now = Date.now()): string {
  const d = new Date(now);
  return `pulse-history-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.csv`;
}

// ------------------------------------------------------------------ saving files

function isNative(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export type SaveResult = 'saved' | 'shared' | 'cancelled' | 'failed';

/**
 * Save a text file. Web: regular download. Native WebView (where <a download>
 * does nothing): hand the File to the system share sheet so the user can save
 * it to Files / Drive or send it. Falls back to a download attempt.
 */
export async function saveTextFile(name: string, text: string, mime: string): Promise<SaveResult> {
  // UTF-8 BOM for CSV so Excel picks the right encoding for names like "Åsgård".
  const parts = mime === 'text/csv' ? ['﻿', text] : [text];
  if (isNative() && typeof navigator.share === 'function' && typeof File === 'function') {
    try {
      const file = new File(parts, name, { type: mime });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    const blob = new Blob(parts, { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
