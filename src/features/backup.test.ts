import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultSettings,
  historyStore,
  presetsStore,
  settingsStore,
  type HistoryEntry,
  type Preset,
} from '../state/store';
import { applyBackup, buildBackup, csvCell, historyToCsv, parseBackup, planMerge } from './backup';

const amrap = { mode: 'amrap' as const, durationSec: 600, sets: 1, restBetweenSetsSec: 0 };

function h(id: string, startedAt: number, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    name: 'Cindy',
    mode: 'amrap',
    config: amrap,
    startedAt,
    durationMs: 1_200_000,
    completed: true,
    rounds: 20,
    roundTimesMs: [],
    laps: [],
    ...extra,
  };
}
const p = (id: string, name = id): Preset => ({ id, name, config: { ...amrap, name }, createdAt: 1 });

beforeEach(() => {
  settingsStore.set({ ...defaultSettings, onboarded: true });
  presetsStore.set([p('p1')]);
  historyStore.set([h('h1', 1000)]);
});

describe('backup', () => {
  it('round-trips through JSON', () => {
    const text = JSON.stringify(buildBackup(5));
    const b = parseBackup(text);
    expect(b).not.toBeNull();
    expect(b!.exportedAt).toBe(5);
    expect(b!.presets.map((x) => x.id)).toEqual(['p1']);
    expect(b!.history.map((x) => x.id)).toEqual(['h1']);
    expect(b!.settings.onboarded).toBe(true);
  });

  it('rejects non-backups and sanitises contents', () => {
    expect(parseBackup('nope')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'pulse-timer', version: 99 }))).toBeNull();
    const b = parseBackup(
      JSON.stringify({
        app: 'pulse-timer',
        version: 1,
        settings: { volume: 9, soundPack: 'kazoo', theme: 'neon' },
        presets: [{ id: 'x', name: 'Bad', config: { mode: 'nope' } }, p('ok')],
        history: [42, h('good', 1)],
      }),
    );
    expect(b!.settings.volume).toBe(1);
    expect(b!.settings.soundPack).toBe('classic');
    expect(b!.settings.theme).toBe('system');
    expect(b!.presets.map((x) => x.id)).toEqual(['ok']);
    expect(b!.history.map((x) => x.id)).toEqual(['good']);
  });

  it('merges by id without duplicates, newest first', () => {
    const plan = planMerge(
      { presets: [p('p1')], history: [h('h1', 1000)] },
      { presets: [p('p1', 'renamed'), p('p2'), p('p2')], history: [h('h1', 1000), h('h2', 3000), h('h0', 10)] },
    );
    expect(plan.presets.map((x) => x.name)).toEqual(['p1', 'p2']);
    expect(plan.history.map((x) => x.id)).toEqual(['h2', 'h1', 'h0']);
    expect(plan).toMatchObject({ addedPresets: 1, addedHistory: 2 });
  });

  it('applies to the stores and never re-triggers onboarding', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'pulse-timer',
        version: 1,
        settings: { ...defaultSettings, onboarded: false, volume: 0.3 },
        presets: [p('p9')],
        history: [h('h9', 2000)],
      }),
    )!;
    applyBackup(b, { settings: true });
    expect(presetsStore.get().map((x) => x.id)).toEqual(['p1', 'p9']);
    expect(historyStore.get().map((x) => x.id)).toEqual(['h9', 'h1']);
    expect(settingsStore.get().volume).toBe(0.3);
    expect(settingsStore.get().onboarded).toBe(true);
  });
});

describe('CSV', () => {
  it('writes a header and one row per entry', () => {
    const csv = historyToCsv([h('a', new Date(2026, 0, 2, 7, 5).getTime(), { name: 'Fran, "fast"', mode: 'fortime', durationMs: 245_000, rounds: 3, completed: false })]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Name,Mode,Duration,Duration (s),Rounds,Completed');
    expect(lines[1]).toBe('2026-01-02 07:05,"Fran, ""fast""",For Time,4:05,245,3,no');
  });

  it('neutralises formula injection', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(-3)).toBe('-3');
  });
});
