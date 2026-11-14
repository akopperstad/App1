import { describe, expect, it } from 'vitest';
import type { WorkoutConfig } from '../engine/types';
import type { HistoryEntry } from '../state/store';
import { computeRecords, niceMax, startOfWeek, weeklyMinutes } from './records';

const DAY = 86_400_000;
const base = new Date(2026, 10, 14, 10, 0).getTime(); // Sat 14 Nov 2026

function entry(p: Partial<HistoryEntry> & { id: string; mode: HistoryEntry['mode'] }): HistoryEntry {
  return {
    name: '',
    config: { mode: p.mode } as WorkoutConfig,
    startedAt: base,
    durationMs: 600_000,
    completed: true,
    rounds: 0,
    roundTimesMs: [],
    laps: [],
    ...p,
  };
}

describe('personal records', () => {
  it('tracks best For Time and most AMRAP rounds per named workout', () => {
    const h = [
      entry({ id: 'f1', mode: 'fortime', name: 'Fran', startedAt: base - 30 * DAY, durationMs: 400_000 }),
      entry({ id: 'f2', mode: 'fortime', name: 'Fran', startedAt: base - 20 * DAY, durationMs: 380_000 }),
      entry({ id: 'f3', mode: 'fortime', name: 'fran ', startedAt: base - 10 * DAY, durationMs: 390_000 }),
      entry({ id: 'f4', mode: 'fortime', name: 'Fran', startedAt: base - 5 * DAY, durationMs: 200_000, completed: false }),
      entry({ id: 'c1', mode: 'amrap', name: 'Cindy', startedAt: base - 9 * DAY, rounds: 18 }),
      entry({ id: 'c2', mode: 'amrap', name: 'Cindy', startedAt: base - 2 * DAY, rounds: 18 }), // tie: no PR
      entry({ id: 'c3', mode: 'amrap', name: 'Cindy', startedAt: base - DAY, rounds: 21 }),
      entry({ id: 't1', mode: 'tabata', name: 'Tabata', rounds: 8 }), // no record kind
      entry({ id: 'u1', mode: 'fortime', name: '', durationMs: 1000 }), // unnamed
    ];
    const { records, prIds } = computeRecords(h);
    expect([...prIds].sort()).toEqual(['c3', 'f2']);
    const fran = records.find((r) => r.mode === 'fortime');
    expect(fran).toMatchObject({ value: 380_000, entryId: 'f2', attempts: 3, kind: 'time' });
    const cindy = records.find((r) => r.mode === 'amrap');
    expect(cindy).toMatchObject({ value: 21, entryId: 'c3', attempts: 3, kind: 'rounds' });
    expect(records).toHaveLength(2);
    // Most recently set first.
    expect(records[0].name).toBe('Cindy');
  });

  it('handles empty history', () => {
    expect(computeRecords([])).toEqual({ records: [], prIds: new Set() });
  });
});

describe('weekly minutes', () => {
  it('buckets the last 8 weeks, oldest first', () => {
    const h = [
      entry({ id: 'a', mode: 'amrap', startedAt: base, durationMs: 20 * 60_000 }),
      entry({ id: 'b', mode: 'amrap', startedAt: startOfWeek(base) + 1000, durationMs: 10 * 60_000 }),
      entry({ id: 'c', mode: 'amrap', startedAt: startOfWeek(base) - 1000, durationMs: 15 * 60_000 }), // previous week
      entry({ id: 'd', mode: 'amrap', startedAt: base - 7 * 8 * DAY, durationMs: 99 * 60_000 }), // too old
      entry({ id: 'e', mode: 'amrap', startedAt: base + 7 * DAY, durationMs: 99 * 60_000 }), // future
    ];
    const w = weeklyMinutes(h, base, 8);
    expect(w).toHaveLength(8);
    expect(w[7].start).toBe(startOfWeek(base));
    expect(w[7]).toMatchObject({ minutes: 30, count: 2 });
    expect(w[6]).toMatchObject({ minutes: 15, count: 1 });
    expect(w.slice(0, 6).every((b) => b.minutes === 0)).toBe(true);
    for (let i = 1; i < 8; i++) expect(new Date(w[i].start).getDay()).toBe(1);
  });

  it('picks readable axis maxima', () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(61)).toBe(90);
    expect(niceMax(700)).toBe(720);
  });
});
