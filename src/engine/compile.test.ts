import { describe, expect, it } from 'vitest';
import { compile, plannedWorkMs } from './compile';
import { MODES, BUILT_IN_PRESETS, describe as describeConfig, totalSeconds } from './modes';
import type { Segment, WorkoutConfig } from './types';

const kinds = (segs: Segment[]) => segs.map((s) => s.kind);
const durs = (segs: Segment[]) => segs.map((s) => s.durationMs);

describe('compile: prep', () => {
  it('includes prep only when prepSec > 0', () => {
    const cfg: WorkoutConfig = { mode: 'countdown', durationSec: 60 };
    expect(kinds(compile(cfg, 0))).toEqual(['work']);
    expect(kinds(compile(cfg, -5))).toEqual(['work']);
    const withPrep = compile(cfg, 10);
    expect(kinds(withPrep)).toEqual(['prep', 'work']);
    expect(withPrep[0]).toMatchObject({ label: 'Get ready', durationMs: 10_000, direction: 'down' });
    expect(withPrep[0].round).toBeUndefined();
  });
});

describe('compile: amrap', () => {
  it('single block', () => {
    const segs = compile({ mode: 'amrap', durationSec: 720, sets: 1, restBetweenSetsSec: 60 }, 0);
    expect(segs).toEqual([
      { kind: 'work', label: 'AMRAP', durationMs: 720_000, direction: 'down', set: 1, totalSets: 1 },
    ]);
  });
  it('multiple blocks with rest only between', () => {
    const segs = compile({ mode: 'amrap', durationSec: 300, sets: 3, restBetweenSetsSec: 60 }, 0);
    expect(kinds(segs)).toEqual(['work', 'rest', 'work', 'rest', 'work']);
    expect(durs(segs)).toEqual([300_000, 60_000, 300_000, 60_000, 300_000]);
    expect(segs.map((s) => s.set)).toEqual([1, 1, 2, 2, 3]);
    expect(segs[1].detail).toBe('Next: AMRAP 2 of 3');
    expect(segs[3].detail).toBe('Next: AMRAP 3 of 3');
  });
  it('no rest segments when rest is 0; sets clamped to >= 1', () => {
    expect(kinds(compile({ mode: 'amrap', durationSec: 60, sets: 2, restBetweenSetsSec: 0 }, 0))).toEqual([
      'work',
      'work',
    ]);
    expect(compile({ mode: 'amrap', durationSec: 60, sets: 0, restBetweenSetsSec: 30 }, 0)).toHaveLength(1);
  });
});

describe('compile: emom', () => {
  it('labels EMOM for 60s, E2MOM / E90s otherwise', () => {
    expect(compile({ mode: 'emom', intervalSec: 60, rounds: 2, movements: [] }, 0)[0].label).toBe('EMOM');
    expect(compile({ mode: 'emom', intervalSec: 120, rounds: 2, movements: [] }, 0)[0].label).toBe('E2MOM');
    expect(compile({ mode: 'emom', intervalSec: 90, rounds: 2, movements: [] }, 0)[0].label).toBe('E90s');
  });
  it('rotates movements and turns a "Rest" movement into a rest segment', () => {
    const segs = compile(
      { mode: 'emom', intervalSec: 60, rounds: 7, movements: ['Strength', ' Burpees ', '', 'rest', 'Core'] },
      0,
    );
    expect(kinds(segs)).toEqual(['work', 'work', 'rest', 'work', 'work', 'work', 'rest']);
    expect(segs.map((s) => s.detail)).toEqual([
      'Strength',
      'Burpees',
      undefined,
      'Core',
      'Strength',
      'Burpees',
      undefined,
    ]);
    expect(segs[2].label).toBe('Rest');
    expect(segs.map((s) => s.round)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(segs.every((s) => s.totalRounds === 7 && s.durationMs === 60_000 && s.direction === 'down')).toBe(
      true,
    );
  });
  it('no movements → detail undefined', () => {
    const segs = compile({ mode: 'emom', intervalSec: 60, rounds: 3, movements: [] }, 0);
    expect(segs.every((s) => s.detail === undefined && s.kind === 'work')).toBe(true);
  });
});

describe('compile: interval / tabata', () => {
  it('classic tabata: 8 work, 7 rest, no trailing rest', () => {
    const segs = compile(
      { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 60, movements: [] },
      0,
    );
    expect(segs).toHaveLength(15);
    expect(segs.at(-1)!.kind).toBe('work');
    segs.forEach((s, i) => {
      expect(s.kind).toBe(i % 2 === 0 ? 'work' : 'rest');
      expect(s.durationMs).toBe(i % 2 === 0 ? 20_000 : 10_000);
      expect(s.round).toBe(Math.floor(i / 2) + 1);
      expect(s.totalRounds).toBe(8);
      expect(s.set).toBe(1);
    });
    expect(plannedWorkMs(segs)).toBe(4 * 60_000 - 10_000);
  });
  it('sets: set rest between sets replaces round rest; movement rotation across sets', () => {
    const segs = compile(
      { mode: 'interval', workSec: 40, restSec: 20, rounds: 2, sets: 2, restBetweenSetsSec: 90, movements: ['A', 'B', 'C'] },
      0,
    );
    expect(segs.map((s) => [s.kind, s.label, s.durationMs, s.round, s.set, s.detail])).toEqual([
      ['work', 'Work', 40_000, 1, 1, 'A'],
      ['rest', 'Rest', 20_000, 1, 1, undefined],
      ['work', 'Work', 40_000, 2, 1, 'B'],
      ['rest', 'Set rest', 90_000, 2, 1, 'Next: set 2 of 2'],
      ['work', 'Work', 40_000, 1, 2, 'C'],
      ['rest', 'Rest', 20_000, 1, 2, undefined],
      ['work', 'Work', 40_000, 2, 2, 'A'],
    ]);
  });
  it('set rest 0 falls back to round rest; rest 0 means back-to-back work', () => {
    const a = compile(
      { mode: 'interval', workSec: 30, restSec: 15, rounds: 2, sets: 2, restBetweenSetsSec: 0, movements: [] },
      0,
    );
    expect(kinds(a)).toEqual(['work', 'rest', 'work', 'rest', 'work', 'rest', 'work']);
    expect(a[3]).toMatchObject({ label: 'Rest', durationMs: 15_000 });
    const b = compile(
      { mode: 'interval', workSec: 30, restSec: 0, rounds: 3, sets: 1, restBetweenSetsSec: 0, movements: [] },
      0,
    );
    expect(kinds(b)).toEqual(['work', 'work', 'work']);
  });
});

describe('compile: fortime / countdown / stopwatch', () => {
  it('fortime with cap counts up and is timed', () => {
    const [s] = compile({ mode: 'fortime', capSec: 600, targetRounds: 3 }, 0);
    expect(s).toEqual({ kind: 'work', label: 'For time', detail: 'Cap 10:00', durationMs: 600_000, direction: 'up' });
  });
  it('fortime without cap is open-ended', () => {
    const [s] = compile({ mode: 'fortime', capSec: 0, targetRounds: 0 }, 0);
    expect(s.durationMs).toBeNull();
    expect(s.direction).toBe('up');
    expect(s.detail).toBeUndefined();
  });
  it('countdown', () => {
    expect(compile({ mode: 'countdown', durationSec: 90 }, 0)).toEqual([
      { kind: 'work', label: 'Countdown', durationMs: 90_000, direction: 'down' },
    ]);
  });
  it('stopwatch', () => {
    expect(compile({ mode: 'stopwatch' }, 10).map((s) => [s.kind, s.durationMs, s.direction])).toEqual([
      ['prep', 10_000, 'down'],
      ['work', null, 'up'],
    ]);
  });
});

describe('compile: deathby', () => {
  it('rep progression and rounds', () => {
    const segs = compile(
      { mode: 'deathby', intervalSec: 60, startReps: 2, increment: 3, maxRounds: 4, movement: 'Burpees' },
      0,
    );
    expect(segs.map((s) => s.detail)).toEqual(['2 Burpees', '5 Burpees', '8 Burpees', '11 Burpees']);
    expect(segs.map((s) => s.round)).toEqual([1, 2, 3, 4]);
    expect(segs.every((s) => s.totalRounds === 4 && s.durationMs === 60_000 && s.kind === 'work')).toBe(true);
  });
  it('empty movement → "reps", maxRounds clamped', () => {
    const segs = compile({ mode: 'deathby', intervalSec: 60, startReps: 1, increment: 1, maxRounds: 0, movement: '' }, 0);
    expect(segs).toHaveLength(1);
    expect(segs[0].detail).toBe('1 reps');
  });
});

describe('compile: custom', () => {
  const steps = [
    { id: 'a', label: 'Run 400m', kind: 'work' as const, durationSec: 0 },
    { id: 'b', label: '  ', kind: 'rest' as const, durationSec: 90 },
    { id: 'c', label: '', kind: 'work' as const, durationSec: 30 },
  ];
  it('untimed steps → null / up; blank labels default; round rest only between rounds', () => {
    const segs = compile({ mode: 'custom', steps, rounds: 2, restBetweenRoundsSec: 60 }, 0);
    expect(segs.map((s) => [s.kind, s.label, s.durationMs, s.direction, s.round])).toEqual([
      ['work', 'Run 400m', null, 'up', 1],
      ['rest', 'Rest', 90_000, 'down', 1],
      ['work', 'Work', 30_000, 'down', 1],
      ['rest', 'Round rest', 60_000, 'down', 1],
      ['work', 'Run 400m', null, 'up', 2],
      ['rest', 'Rest', 90_000, 'down', 2],
      ['work', 'Work', 30_000, 'down', 2],
    ]);
    expect(segs[3].detail).toBe('Next: round 2 of 2');
    expect(plannedWorkMs(segs)).toBeNull();
  });
  it('negative durations dropped, no round rest when 0', () => {
    const segs = compile(
      {
        mode: 'custom',
        rounds: 2,
        restBetweenRoundsSec: 0,
        steps: [
          { id: 'x', label: 'X', kind: 'work', durationSec: -3 },
          { id: 'y', label: 'Y', kind: 'work', durationSec: 10 },
        ],
      },
      0,
    );
    expect(segs.map((s) => s.label)).toEqual(['Y', 'Y']);
  });
  it('zero-duration steps only → all open-ended', () => {
    const segs = compile(
      {
        mode: 'custom',
        rounds: 2,
        restBetweenRoundsSec: 0,
        steps: [{ id: 'x', label: 'X', kind: 'work', durationSec: 0 }],
      },
      0,
    );
    expect(segs.map((s) => [s.durationMs, s.direction])).toEqual([
      [null, 'up'],
      [null, 'up'],
    ]);
  });
  it('no steps → single open-ended work segment (no orphan round rests)', () => {
    const segs = compile({ mode: 'custom', rounds: 3, restBetweenRoundsSec: 30, steps: [] }, 5);
    expect(segs.map((s) => [s.kind, s.durationMs])).toEqual([
      ['prep', 5000],
      ['work', null],
    ]);
  });
});

describe('plannedWorkMs', () => {
  it('excludes prep, null if any open-ended', () => {
    expect(plannedWorkMs(compile({ mode: 'countdown', durationSec: 30 }, 10))).toBe(30_000);
    expect(plannedWorkMs(compile({ mode: 'stopwatch' }, 10))).toBeNull();
  });
});

// ------------------------------------------------------------ totalSeconds parity

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x1_0000_0000;
  };
}

function randomConfig(r: () => number): WorkoutConfig {
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const modes = ['amrap', 'emom', 'tabata', 'interval', 'fortime', 'countdown', 'deathby', 'custom'] as const;
  const mode = modes[int(0, modes.length - 1)];
  switch (mode) {
    case 'amrap':
      return { mode, durationSec: int(0, 1200), sets: int(0, 5), restBetweenSetsSec: int(0, 3) * 30 };
    case 'emom':
      return { mode, intervalSec: int(10, 180), rounds: int(0, 30), movements: r() < 0.5 ? [] : ['A', 'Rest', ''] };
    case 'tabata':
    case 'interval':
      return {
        mode,
        workSec: int(5, 300),
        restSec: int(0, 2) * int(0, 60),
        rounds: int(0, 12),
        sets: int(0, 4),
        restBetweenSetsSec: int(0, 1) * int(0, 180),
        movements: [],
      };
    case 'fortime':
      return { mode, capSec: int(1, 3600), targetRounds: int(0, 5) };
    case 'countdown':
      return { mode, durationSec: int(0, 3600) };
    case 'deathby':
      return { mode, intervalSec: int(30, 120), startReps: 1, increment: 1, maxRounds: int(0, 40), movement: 'x' };
    case 'custom': {
      const n = int(1, 6);
      return {
        mode,
        rounds: int(0, 5),
        restBetweenRoundsSec: int(0, 1) * int(0, 120),
        steps: Array.from({ length: n }, (_, i) => ({
          id: String(i),
          label: `s${i}`,
          kind: r() < 0.5 ? ('work' as const) : ('rest' as const),
          durationSec: int(1, 120),
        })),
      };
    }
  }
}

describe('totalSeconds parity with compile', () => {
  const check = (cfg: WorkoutConfig) => {
    const planned = plannedWorkMs(compile(cfg, 0));
    const expected = planned === null ? null : planned / 1000;
    expect(totalSeconds(cfg), JSON.stringify(cfg)).toBe(expected);
    // Prep never counts toward the planned total.
    expect(plannedWorkMs(compile(cfg, 10))).toBe(planned);
  };
  it('mode defaults and built-in presets', () => {
    MODES.forEach((m) => check(m.defaults));
    BUILT_IN_PRESETS.forEach((p) => check(p.config));
  });
  it('500 random configs', () => {
    const r = rng(12345);
    for (let i = 0; i < 500; i++) check(randomConfig(r));
  });
  it('edge configs', () => {
    check({ mode: 'amrap', durationSec: 60, sets: 0, restBetweenSetsSec: 30 });
    check({ mode: 'interval', workSec: 30, restSec: 10, rounds: 0, sets: 0, restBetweenSetsSec: 60, movements: [] });
    check({ mode: 'interval', workSec: 30, restSec: 10, rounds: 3, sets: 3, restBetweenSetsSec: 0, movements: [] });
    check({ mode: 'custom', rounds: 2, restBetweenRoundsSec: 30, steps: [] });
    check({
      mode: 'custom',
      rounds: 2,
      restBetweenRoundsSec: 30,
      steps: [{ id: 'a', label: 'a', kind: 'work', durationSec: -5 }, { id: 'b', label: 'b', kind: 'work', durationSec: 20 }],
    });
    check({ mode: 'fortime', capSec: 0, targetRounds: 0 });
    check({ mode: 'stopwatch' });
  });
});

describe('describe()', () => {
  it('summaries', () => {
    expect(describeConfig({ mode: 'amrap', durationSec: 720, sets: 1, restBetweenSetsSec: 60 })).toBe('12 min');
    expect(describeConfig({ mode: 'amrap', durationSec: 300, sets: 3, restBetweenSetsSec: 60 })).toBe(
      '3 × 5 min · 1 min rest',
    );
    expect(describeConfig({ mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] })).toBe(
      '8 × 20s / 10s',
    );
    expect(describeConfig({ mode: 'fortime', capSec: 0, targetRounds: 0 })).toBe('No cap');
    expect(describeConfig({ mode: 'emom', intervalSec: 60, rounds: 10, movements: ['A', ' ', ''] })).toBe(
      '10 × 1 min · 1 movement',
    );
    expect(describeConfig({ mode: 'emom', intervalSec: 60, rounds: 10, movements: ['', ' '] })).toBe('10 × 1 min');
  });
});
