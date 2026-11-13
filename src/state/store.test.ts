import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../engine/compile';
import { describe as describeConfig, modeInfo } from '../engine/modes';

const KEYS = {
  settings: 'pulse.settings.v1',
  presets: 'pulse.presets.v1',
  history: 'pulse.history.v1',
  last: 'pulse.lastConfigs.v1',
};

async function loadWith(values: Partial<Record<keyof typeof KEYS, string>>) {
  localStorage.clear();
  for (const [k, v] of Object.entries(values)) localStorage.setItem(KEYS[k as keyof typeof KEYS], v!);
  vi.resetModules();
  return import('./store');
}

afterEach(() => localStorage.clear());

describe('store: loading corrupted / old-shaped data never crashes', () => {
  it('invalid JSON falls back to defaults', async () => {
    const s = await loadWith({ settings: '{nope', presets: '[', history: 'undefined', last: '}' });
    expect(s.settingsStore.get()).toEqual(s.defaultSettings);
    expect(s.presetsStore.get()).toEqual([]);
    expect(s.historyStore.get()).toEqual([]);
    expect(s.lastConfigStore.get()).toEqual({});
  });

  it('wrong top-level shapes fall back to defaults', async () => {
    const s = await loadWith({ settings: '"loud"', presets: '{"a":1}', history: 'null', last: '[1,2]' });
    expect(s.settingsStore.get()).toEqual(s.defaultSettings);
    expect(s.presetsStore.get()).toEqual([]);
    expect(s.historyStore.get()).toEqual([]);
    expect(s.lastConfigStore.get()).toEqual({});
  });

  it('settings: wrong-typed fields are replaced by defaults, valid ones kept', async () => {
    const s = await loadWith({
      settings: JSON.stringify({ prepSec: 'ten', volume: 7, sound: 'yes', voice: false, theme: 'neon', extra: 1 }),
    });
    const st = s.settingsStore.get();
    expect(st).toEqual({ ...s.defaultSettings, voice: false, volume: 1 });
  });

  it('presets / history / last configs from an older version are repaired or dropped', async () => {
    const s = await loadWith({
      presets: JSON.stringify([
        { id: 'p1', name: 'Old EMOM', config: { mode: 'emom', intervalSec: 60, rounds: 5 }, createdAt: 1 },
        { id: 'p2', name: 'Broken', config: { mode: 'yoga' } },
        null,
        'x',
        { name: 'No id', config: { mode: 'custom', rounds: 2 } },
      ]),
      history: JSON.stringify([
        { id: 'h1', name: 'Run', mode: 'tabata', config: { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8 }, startedAt: 5, durationMs: 1000 },
        { id: 'h2', mode: 'nope', config: {} },
        { config: { mode: 'stopwatch' }, laps: [{ atMs: 1, splitMs: 1 }, null], roundTimesMs: [1, 'x'] },
        42,
      ]),
      last: JSON.stringify({ emom: { mode: 'emom' }, amrap: { mode: 'emom', rounds: 2 }, yoga: { mode: 'yoga' }, custom: null }),
    });

    const presets = s.presetsStore.get();
    expect(presets.map((p) => p.name)).toEqual(['Old EMOM', 'No id']);
    expect(presets[1].id).toBeTruthy();
    for (const p of presets) {
      expect(() => compile(p.config, 10)).not.toThrow();
      expect(() => describeConfig(p.config)).not.toThrow();
    }

    const history = s.historyStore.get();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ id: 'h1', mode: 'tabata', completed: false, rounds: 0, laps: [], roundTimesMs: [] });
    expect(history[1]).toMatchObject({ mode: 'stopwatch', durationMs: 0, laps: [{ atMs: 1, splitMs: 1 }], roundTimesMs: [1] });
    for (const h of history) {
      expect(modeInfo(h.mode)).toBeDefined();
      expect(() => describeConfig(h.config)).not.toThrow();
    }

    const last = s.lastConfigStore.get();
    expect(Object.keys(last)).toEqual(['emom']);
    expect(last.emom).toMatchObject({ mode: 'emom', intervalSec: 60, rounds: 10, movements: [] });
  });
});

describe('store: history upsert', () => {
  it('saveHistory inserts once, then updates the same entry in place', async () => {
    const s = await loadWith({});
    const base = {
      name: 'X',
      mode: 'stopwatch' as const,
      config: { mode: 'stopwatch' as const },
      startedAt: 1,
      durationMs: 1000,
      completed: false,
      rounds: 0,
      roundTimesMs: [],
      laps: [],
    };
    s.addHistory({ ...base, name: 'older' });
    const id = s.saveHistory(null, base);
    s.saveHistory(id, { ...base, durationMs: 5000, completed: true });
    const list = s.historyStore.get();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id, durationMs: 5000, completed: true });
    // An entry deleted meanwhile is re-added rather than silently lost.
    s.deleteHistory(id);
    s.saveHistory(id, base);
    expect(s.historyStore.get().map((h) => h.id)).toEqual([id, list[1].id]);
  });
});
