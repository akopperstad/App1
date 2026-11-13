import { describe, expect, it } from 'vitest';
import { compile } from './compile';
import { describe as describeConfig, MODES, totalSeconds } from './modes';
import { normalizeConfig } from './normalize';
import type { WorkoutConfig } from './types';

describe('normalizeConfig', () => {
  it('rejects non-objects and unknown modes', () => {
    for (const raw of [null, undefined, 42, 'amrap', [], {}, { mode: 'yoga' }]) {
      expect(normalizeConfig(raw)).toBeNull();
    }
  });

  it('returns valid configs unchanged (same keys, same order)', () => {
    for (const m of MODES) {
      const c = { ...m.defaults, name: 'X' };
      const n = normalizeConfig(c)!;
      expect(n).toEqual(c);
      expect(JSON.stringify(n)).toBe(JSON.stringify(c));
    }
  });

  it('fills missing fields from defaults (presets saved by an older version)', () => {
    const n = normalizeConfig({ mode: 'emom', intervalSec: 60, rounds: 10 }) as Extract<WorkoutConfig, { mode: 'emom' }>;
    expect(n.movements).toEqual([]);
    const i = normalizeConfig({ mode: 'interval', workSec: 30, restSec: 10, rounds: 5 }) as Extract<
      WorkoutConfig,
      { mode: 'interval' }
    >;
    expect(i).toMatchObject({ sets: 1, restBetweenSetsSec: 90, movements: [] });
    const c = normalizeConfig({ mode: 'custom', rounds: 2 }) as Extract<WorkoutConfig, { mode: 'custom' }>;
    expect(Array.isArray(c.steps)).toBe(true);
  });

  it('coerces garbage values into runnable numbers', () => {
    const n = normalizeConfig({
      mode: 'amrap',
      durationSec: 'abc',
      sets: NaN,
      restBetweenSetsSec: -30,
      name: 7,
    }) as Extract<WorkoutConfig, { mode: 'amrap' }>;
    expect(n.durationSec).toBe(720); // the AMRAP default
    expect(n.sets).toBe(1);
    expect(n.restBetweenSetsSec).toBe(0);
    expect(n.name).toBeUndefined();
    const s = normalizeConfig({
      mode: 'custom',
      rounds: 0,
      restBetweenRoundsSec: null,
      steps: [null, { label: 5, kind: 'nap', durationSec: 'x' }, { id: 'b', label: 'B', kind: 'rest', durationSec: 30 }],
    }) as Extract<WorkoutConfig, { mode: 'custom' }>;
    expect(s.rounds).toBe(1);
    expect(s.restBetweenRoundsSec).toBe(0);
    expect(s.steps).toEqual([
      { id: 's1', label: '', kind: 'work', durationSec: 0 },
      { id: 'b', label: 'B', kind: 'rest', durationSec: 30 },
    ]);
  });
});

describe('compile / describe / totalSeconds never crash on malformed configs', () => {
  const broken = [
    { mode: 'emom', intervalSec: 60, rounds: 3 },
    { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8 },
    { mode: 'interval' },
    { mode: 'custom', rounds: 2 },
    { mode: 'custom', rounds: 2, steps: [{ label: undefined, kind: 'work', durationSec: 10 }] },
    { mode: 'amrap' },
    { mode: 'deathby' },
    { mode: 'countdown', durationSec: Infinity },
  ] as unknown as WorkoutConfig[];

  it.each(broken.map((c) => [c.mode, c] as const))('%s', (_m, c) => {
    expect(() => describeConfig(c)).not.toThrow();
    expect(() => totalSeconds(c)).not.toThrow();
    const segs = compile(c, 10);
    expect(segs.length).toBeGreaterThan(0);
    for (const s of segs) expect(s.durationMs === null || Number.isFinite(s.durationMs)).toBe(true);
  });
});
