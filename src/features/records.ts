/**
 * History analytics: personal records and weekly activity. Pure functions.
 *
 * Records are tracked per named workout (saved presets / benchmarks — the
 * entry's name), per mode:
 *   - For Time: fastest completed time (lower is better)
 *   - AMRAP:    most rounds in a completed AMRAP (higher is better)
 * An entry "sets a PR" when it strictly beats every earlier attempt of the
 * same workout. The first attempt only establishes the baseline (no badge).
 */
import type { Mode } from '../engine/types';
import type { HistoryEntry } from '../state/store';

export type RecordKind = 'time' | 'rounds';

export interface PersonalRecord {
  /** Stable key: mode + normalised name. */
  key: string;
  name: string;
  mode: Mode;
  kind: RecordKind;
  /** ms for 'time', rounds for 'rounds'. */
  value: number;
  /** History id of the entry holding the record. */
  entryId: string;
  at: number;
  attempts: number;
}

export function recordKind(mode: Mode): RecordKind | null {
  if (mode === 'fortime') return 'time';
  if (mode === 'amrap') return 'rounds';
  return null;
}

function eligible(h: HistoryEntry): { key: string; kind: RecordKind; value: number } | null {
  const kind = recordKind(h.mode);
  const name = (h.name || '').trim();
  if (!kind || !name || !h.completed) return null;
  if (kind === 'time' && !(h.durationMs > 0)) return null;
  if (kind === 'rounds' && !(h.rounds > 0)) return null;
  // For Time with a target round count but not all rounds tapped isn't a full result —
  // `completed` already reflects that the plan ran to its end.
  return { key: `${h.mode}:${name.toLocaleLowerCase()}`, kind, value: kind === 'time' ? h.durationMs : h.rounds };
}

const better = (kind: RecordKind, a: number, b: number) => (kind === 'time' ? a < b : a > b);

export interface RecordsResult {
  /** Current best per workout, most recently set first. */
  records: PersonalRecord[];
  /** Ids of history entries that beat all previous attempts when they were done. */
  prIds: Set<string>;
}

export function computeRecords(history: HistoryEntry[]): RecordsResult {
  const chrono = [...history].sort((a, b) => a.startedAt - b.startedAt);
  const best = new Map<string, PersonalRecord>();
  const prIds = new Set<string>();
  for (const h of chrono) {
    const e = eligible(h);
    if (!e) continue;
    const cur = best.get(e.key);
    if (!cur) {
      best.set(e.key, {
        key: e.key,
        name: h.name.trim(),
        mode: h.mode,
        kind: e.kind,
        value: e.value,
        entryId: h.id,
        at: h.startedAt,
        attempts: 1,
      });
      continue;
    }
    cur.attempts++;
    if (better(e.kind, e.value, cur.value)) {
      cur.value = e.value;
      cur.entryId = h.id;
      cur.at = h.startedAt;
      cur.name = h.name.trim();
      prIds.add(h.id);
    }
  }
  const records = [...best.values()].sort((a, b) => b.at - a.at);
  return { records, prIds };
}

// ------------------------------------------------------------------ weekly activity

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local Monday 00:00 of the week containing t. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export interface WeekBucket {
  /** Local Monday 00:00. */
  start: number;
  minutes: number;
  count: number;
}

/** Minutes trained per week for the last `weeks` weeks (oldest first, current week last). */
export function weeklyMinutes(history: HistoryEntry[], now: number, weeks = 8): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const d = new Date(startOfWeek(now));
  d.setDate(d.getDate() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++) {
    buckets.push({ start: d.getTime(), minutes: 0, count: 0 });
    d.setDate(d.getDate() + 7); // calendar arithmetic: DST-safe
  }
  const end = (() => {
    const e = new Date(buckets[buckets.length - 1].start);
    e.setDate(e.getDate() + 7);
    return e.getTime();
  })();
  for (const h of history) {
    if (h.startedAt < buckets[0].start || h.startedAt >= end) continue;
    let i = buckets.length - 1;
    while (i > 0 && h.startedAt < buckets[i].start) i--;
    buckets[i].minutes += h.durationMs / 60000;
    buckets[i].count++;
  }
  for (const b of buckets) b.minutes = Math.round(b.minutes);
  return buckets;
}

/** A "nice" axis maximum ≥ v (10, 20, 30, 60, 90, 120, …). */
export function niceMax(v: number): number {
  if (v <= 10) return 10;
  const steps = [20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600];
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 120) * 120;
}
