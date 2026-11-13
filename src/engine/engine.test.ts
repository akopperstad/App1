import { describe, expect, it } from 'vitest';
import { compile, plannedWorkMs } from './compile';
import { TimerEngine } from './engine';
import type { Cue, Segment, WorkoutConfig } from './types';
import { formatClock } from '../lib/format';

// ------------------------------------------------------------------ harness

interface Logged {
  t: number;
  cue: Cue;
}

function harness(segments: Segment[]) {
  const clock = { t: 1_000_000 }; // non-zero origin, like performance.now()
  const t0 = clock.t;
  const log: Logged[] = [];
  const engine = new TimerEngine(segments, {
    now: () => clock.t,
    onCue: (cue) => log.push({ t: clock.t - t0, cue }),
  });
  return {
    engine,
    log,
    /** Elapsed wall time since harness creation. */
    get t() {
      return clock.t - t0;
    },
    /** Set wall time (relative to origin) without ticking. */
    set(ms: number) {
      clock.t = t0 + ms;
    },
    advance(ms: number) {
      clock.t += ms;
    },
    /** Move wall time to `ms` (relative) and tick. */
    at(ms: number) {
      clock.t = t0 + ms;
      return engine.tick();
    },
    /** Tick every `step` ms (or with jitter fn) until wall time `ms`. */
    run(ms: number, step: number | (() => number) = 16) {
      while (clock.t - t0 < ms) {
        const d = typeof step === 'number' ? step : step();
        clock.t = Math.min(t0 + ms, clock.t + d);
        engine.tick();
      }
      return engine.snapshot();
    },
    types: () => log.map((l) => l.cue.type),
    of: <T extends Cue['type']>(type: T) =>
      log.filter((l) => l.cue.type === type) as { t: number; cue: Extract<Cue, { type: T }> }[],
  };
}

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

const seg = (durationMs: number | null, kind: Segment['kind'] = 'work', label = kind): Segment => ({
  kind,
  label,
  durationMs,
  direction: durationMs === null ? 'up' : 'down',
});

/** Planned session-elapsed start time of every segment (incl. prep). */
function boundaries(segs: Segment[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const s of segs) {
    out.push(acc);
    acc += s.durationMs ?? 0;
  }
  out.push(acc);
  return out;
}

// 20-minute workout: 10s prep + 3 sets x (8 x 40s/20s) with 90s set rest ≈ 20 min.
const LONG: WorkoutConfig = {
  mode: 'interval',
  workSec: 40,
  restSec: 20,
  rounds: 6,
  sets: 3,
  restBetweenSetsSec: 90,
  movements: [],
};

// ------------------------------------------------------------ drift / timing

describe('engine timing: no drift', () => {
  const segs = compile(LONG, 10);
  const bounds = boundaries(segs);
  const total = bounds.at(-1)!;

  it('the long fixture is ~20 minutes', () => {
    expect(total).toBeGreaterThan(19 * 60_000);
    expect(total).toBeLessThan(21 * 60_000);
  });

  /** Cue-relevant fingerprint of a full run (cue types, segment indices, counts — not tick-time). */
  function fullRun(step: number | (() => number)) {
    const h = harness(segs);
    h.engine.start();
    const indexSeen: { idx: number; firstSeenAt: number }[] = [];
    let last = -1;
    while (h.engine.getStatus() !== 'finished') {
      const d = typeof step === 'number' ? step : step();
      h.advance(d);
      const snap = h.engine.tick();
      if (snap.segmentIndex !== last) {
        last = snap.segmentIndex;
        indexSeen.push({ idx: snap.segmentIndex, firstSeenAt: h.t });
      }
      // Invariant: the engine's segment position matches the plan exactly.
      // (plain checks, not expect(): this runs up to ~1.2M times)
      if (
        snap.status === 'running' &&
        (snap.totalElapsedMs !== h.t ||
          bounds[snap.segmentIndex] > h.t ||
          h.t >= bounds[snap.segmentIndex + 1] ||
          snap.segmentElapsedMs !== h.t - bounds[snap.segmentIndex])
      ) {
        throw new Error(`timeline off at t=${h.t}: index ${snap.segmentIndex}, segElapsed ${snap.segmentElapsedMs}`);
      }
    }
    return { h, indexSeen };
  }

  it('segment boundaries land exactly on plan with random 1-200ms jitter', () => {
    const r = rng(42);
    const { h } = fullRun(() => 1 + Math.floor(r() * 200));
    const segCues = h.of('segment');
    expect(segCues.map((c) => c.cue.index)).toEqual(segs.slice(1).map((_, i) => i + 1));
    const snap = h.engine.snapshot();
    expect(snap.status).toBe('finished');
    expect(snap.totalElapsedMs).toBe(total); // exact, despite the late final tick
    expect(snap.workElapsedMs).toBe(plannedWorkMs(segs));
    expect(snap.overallProgress).toBe(1);
    expect(h.of('finish')).toHaveLength(1);
  });

  it('cue sequence is identical regardless of tick frequency', () => {
    const r = rng(7);
    const runs = [
      fullRun(1),
      fullRun(16),
      fullRun(100),
      fullRun(() => 1 + Math.floor(r() * 200)),
      fullRun(() => 1 + Math.floor(r() * 1000)),
    ];
    const sig = (h: ReturnType<typeof harness>) =>
      h.log.map((l) => JSON.stringify({ ...l.cue, segment: undefined, previous: undefined }));
    const ref = sig(runs[0].h);
    for (const run of runs.slice(1)) expect(sig(run.h)).toEqual(ref);

    // With 1ms ticks every cue lands within 1ms of its exact ideal time.
    const h = runs[0].h;
    for (const { t, cue } of h.log) {
      if (cue.type === 'segment') expect(t).toBe(bounds[cue.index]);
      if (cue.type === 'countdown') {
        const idx = h.engine.getSegments().indexOf(cue.segment);
        expect(t).toBe(bounds[idx + 1] - cue.n * 1000);
      }
    }
  }, 120_000);

  it('ticks landing late still schedule from the planned boundary, not the tick', () => {
    const h = harness([seg(10_000), seg(10_000), seg(10_000)]);
    h.engine.start();
    h.at(10_700); // late by 700ms
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 700 });
    h.at(20_000);
    expect(h.engine.snapshot().segmentIndex).toBe(2);
    expect(h.engine.snapshot().segmentElapsedMs).toBe(0);
  });

  it('works with fractional (performance.now-like) clock values', () => {
    const segs2 = [seg(3_000, 'prep'), seg(5_000), seg(5_000, 'rest'), seg(5_000)];
    const h = harness(segs2);
    h.engine.start();
    const r = rng(99);
    h.run(18_100, () => 0.1 + r() * 33.3);
    const snap = h.engine.snapshot();
    expect(snap.status).toBe('finished');
    expect(snap.totalElapsedMs).toBe(18_000);
    expect(snap.workElapsedMs).toBe(15_000);
    expect(h.of('countdown').map((c) => c.cue.n)).toEqual([2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1]);
  });
});

describe('engine timing: pause/resume', () => {
  it('excludes paused time', () => {
    const h = harness([seg(60_000)]);
    h.engine.start();
    h.run(10_000);
    h.engine.pause();
    expect(h.engine.getStatus()).toBe('paused');
    h.set(500_000); // long pause
    expect(h.engine.tick().totalElapsedMs).toBe(10_000);
    h.engine.resume();
    h.run(500_000 + 49_999);
    expect(h.engine.snapshot()).toMatchObject({ status: 'running', segmentRemainingMs: 1 });
    h.at(500_000 + 50_000);
    expect(h.engine.getStatus()).toBe('finished');
    expect(h.engine.snapshot().totalElapsedMs).toBe(60_000);
    expect(h.types().filter((t) => t === 'pause' || t === 'resume')).toEqual(['pause', 'resume']);
  });

  it('pausing at a boundary cannot lose or duplicate time', () => {
    const h = harness([seg(5_000), seg(5_000)]);
    h.engine.start();
    h.set(5_000);
    h.engine.pause(); // pause itself advances to the boundary
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 0, totalElapsedMs: 5_000 });
    h.set(9_000);
    h.engine.start();
    h.at(14_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 10_000 });
  });

  it('pause right when the workout ends finishes instead of pausing', () => {
    const h = harness([seg(5_000)]);
    h.engine.start();
    h.set(6_000);
    h.engine.pause();
    expect(h.engine.getStatus()).toBe('finished');
    expect(h.engine.snapshot().totalElapsedMs).toBe(5_000);
    expect(h.types()).not.toContain('pause');
  });
});

describe('engine timing: background catch-up', () => {
  it('90s gap crosses several segments: no stale countdowns, one segment cue for the final segment', () => {
    // prep 10, then tabata-ish 20/10
    const segs = compile(
      { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] },
      10,
    );
    const h = harness(segs);
    h.engine.start();
    h.run(12_000); // into first work
    const before = h.log.length;
    h.at(12_000 + 90_000); // 102s → prep 10 + 3 * 30 = 100 → segment 7 (work, round 4), 2s in
    const after = h.log.slice(before);
    expect(after.map((l) => l.cue.type)).toEqual(['segment']);
    const cue = after[0].cue as Extract<Cue, { type: 'segment' }>;
    expect(cue.index).toBe(7);
    expect(cue.segment).toBe(h.engine.getSegments()[7]);
    expect(cue.previous.kind).toBe('work');
    const snap = h.engine.snapshot();
    expect(snap).toMatchObject({ segmentIndex: 7, segmentElapsedMs: 2_000, workElapsedMs: 92_000 });

    // Normal cues resume afterwards.
    h.run(12_000 + 90_000 + 18_000, 16);
    expect(h.of('countdown').filter((c) => c.t > 102_000).map((c) => c.cue.n)).toEqual([3, 2, 1]);
  });

  it('gap that lands past the end finishes exactly at the end, with only a finish cue', () => {
    const h = harness([seg(10_000, 'prep'), seg(30_000), seg(30_000, 'rest')]);
    h.engine.start();
    h.run(1_000);
    const before = h.log.length;
    h.at(500_000);
    expect(h.log.slice(before).map((l) => l.cue.type)).toEqual(['finish']);
    expect(h.engine.snapshot()).toMatchObject({
      status: 'finished',
      totalElapsedMs: 70_000,
      workElapsedMs: 60_000,
      plannedWorkMs: 60_000,
      overallProgress: 1,
    });
  });

  it('gap within one segment emits nothing stale (no minute / tenSeconds burst)', () => {
    const h = harness([seg(600_000)]);
    h.engine.start();
    h.run(1_000);
    const before = h.log.length;
    h.at(400_000);
    expect(h.log.length).toBe(before);
    h.run(410_000);
    // Minute 7 (3 remaining) fires at 420s, later.
    h.run(421_000);
    expect(h.of('minute').map((m) => m.cue.minutesRemaining)).toEqual([3]);
  });
});

describe('engine: finish', () => {
  it('fires finish exactly once at the exact end; finished snapshot is exact', () => {
    const segs = [seg(5_000, 'prep'), seg(20_000), seg(10_000, 'rest'), seg(20_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(54_990, 10);
    expect(h.engine.getStatus()).toBe('running');
    h.at(55_037); // late tick
    for (let i = 0; i < 5; i++) h.at(56_000 + i * 100);
    expect(h.of('finish')).toHaveLength(1);
    expect(h.of('finish')[0].t).toBe(55_037);
    const s = h.engine.snapshot();
    expect(s).toMatchObject({
      status: 'finished',
      totalElapsedMs: 55_000,
      workElapsedMs: 50_000,
      plannedWorkMs: 50_000,
      overallProgress: 1,
      segmentIndex: 3,
      segmentRemainingMs: 0,
      segmentProgress: 1,
    });
    // Time keeps passing; finished snapshot is frozen.
    h.set(1_000_000);
    expect(h.engine.snapshot().totalElapsedMs).toBe(55_000);
  });

  it('manual finish() while running freezes at the current time (no double counting)', () => {
    const h = harness([seg(null)]);
    h.engine.start();
    h.run(12_345);
    h.engine.finish();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 12_345, workElapsedMs: 12_345 });
    h.set(99_999);
    expect(h.engine.snapshot().totalElapsedMs).toBe(12_345);
    h.engine.finish();
    expect(h.of('finish')).toHaveLength(1);
  });

  it('manual finish() after the planned end passed (no tick) finishes at the planned end', () => {
    const h = harness([seg(10_000)]);
    h.engine.start();
    h.set(13_000);
    h.engine.finish();
    expect(h.engine.snapshot().totalElapsedMs).toBe(10_000);
    expect(h.of('finish')).toHaveLength(1);
  });

  it('finish() while paused and while idle', () => {
    const h = harness([seg(10_000)]);
    h.engine.finish();
    expect(h.engine.getStatus()).toBe('idle');
    h.engine.start();
    h.run(4_000);
    h.engine.pause();
    h.set(8_000);
    h.engine.finish();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 4_000 });
  });

  it('open-ended segment never auto-advances (stopwatch)', () => {
    const h = harness(compile({ mode: 'stopwatch' }, 0));
    h.engine.start();
    h.run(3 * 3600_000, 997);
    const s = h.engine.snapshot();
    expect(s).toMatchObject({
      status: 'running',
      segmentIndex: 0,
      segmentRemainingMs: null,
      segmentProgress: 0,
      plannedWorkMs: null,
      overallProgress: 0,
    });
    expect(s.segmentElapsedMs).toBe(3 * 3600_000);
  });

  it('fortime: no cap never ends; with cap finishes at the cap', () => {
    const open = harness(compile({ mode: 'fortime', capSec: 0, targetRounds: 0 }, 10));
    open.engine.start();
    open.run(3600_000, 500);
    expect(open.engine.snapshot()).toMatchObject({ status: 'running', segmentIndex: 1, workElapsedMs: 3590_000 });

    const capped = harness(compile({ mode: 'fortime', capSec: 600, targetRounds: 0 }, 10));
    capped.engine.start();
    capped.run(700_000, 333);
    expect(capped.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 610_000, workElapsedMs: 600_000 });
    expect(capped.of('finish')).toHaveLength(1);
  });
});

// --------------------------------------------------------------------- cues

describe('cues', () => {
  it('start / pause / resume', () => {
    const h = harness([seg(10_000, 'prep'), seg(60_000)]);
    h.engine.start();
    expect(h.log[0]).toMatchObject({ t: 0, cue: { type: 'start', index: 0 } });
    expect((h.log[0].cue as Extract<Cue, { type: 'start' }>).segment.kind).toBe('prep');
    h.run(1_000);
    h.engine.pause();
    h.engine.pause();
    h.engine.resume();
    h.engine.resume();
    h.engine.start();
    expect(h.types()).toEqual(['start', 'pause', 'resume']);
    h.engine.toggle();
    h.engine.toggle();
    expect(h.types()).toEqual(['start', 'pause', 'resume', 'pause', 'resume']);
  });

  it('pause while idle does nothing', () => {
    const h = harness([seg(10_000)]);
    h.engine.pause();
    expect(h.engine.getStatus()).toBe('idle');
    expect(h.log).toHaveLength(0);
  });

  it('countdown 3,2,1 exactly once per segment at exact times; none for short segments', () => {
    const lens = [500, 1000, 1500, 2000, 2500, 3000, 3001, 4000, 20_000];
    const segs = lens.map((d) => seg(d));
    const h = harness(segs);
    h.engine.start();
    h.run(boundaries(segs).at(-1)! + 10, 1);
    const b = boundaries(segs);
    const got = h.of('countdown').map((c) => ({ idx: h.engine.getSegments().indexOf(c.cue.segment), n: c.cue.n, t: c.t }));
    const expected: typeof got = [];
    lens.forEach((d, idx) => {
      for (const n of [3, 2, 1]) if (d > n * 1000) expected.push({ idx, n, t: b[idx + 1] - n * 1000 });
    });
    expect(got).toEqual(expected);
  });

  it('countdown agrees with the round-up display: the beep fires exactly when the digit appears', () => {
    const h = harness([seg(10_000)]);
    h.engine.start();
    while (h.engine.getStatus() === 'running') {
      const before = h.log.length;
      h.advance(1);
      const snap = h.engine.tick();
      const fresh = h.log.slice(before).filter((l) => l.cue.type === 'countdown');
      if (snap.status !== 'running') break;
      const shown = formatClock(snap.segmentRemainingMs!, { roundUp: true }).main;
      const prevShown = formatClock(snap.segmentRemainingMs! + 1, { roundUp: true }).main;
      if (fresh.length) {
        const n = (fresh[0].cue as Extract<Cue, { type: 'countdown' }>).n;
        expect(shown).toBe(`0:0${n}`);
        expect(prevShown).toBe(`0:0${n + 1}`); // the digit just changed
      } else if (shown !== prevShown && ['0:03', '0:02', '0:01'].includes(shown)) {
        throw new Error(`display changed to ${shown} without a beep`);
      }
    }
    expect(h.of('countdown').map((c) => [c.cue.n, c.t])).toEqual([
      [3, 7_000],
      [2, 8_000],
      [1, 9_000],
    ]);
  });

  it('a late tick that skips past several countdown thresholds emits only the current one', () => {
    const h = harness([seg(10_000), seg(10_000)]);
    h.engine.start();
    h.at(6_500);
    h.at(7_900); // crossed 3 only (gap 1400 < catch-up threshold)
    h.at(9_300); // crossed 2 and 1 → only 1
    expect(h.of('countdown').map((c) => c.cue.n)).toEqual([3, 1]);
  });

  it('tenSeconds only for segments >= 30s, at exactly 10s remaining', () => {
    const segs = [seg(29_999), seg(30_000), seg(45_000, 'rest'), seg(15_000, 'prep')];
    const h = harness(segs);
    h.engine.start();
    h.run(boundaries(segs).at(-1)!, 7);
    const b = boundaries(segs);
    const got = h.of('tenSeconds').map((c) => [h.engine.getSegments().indexOf(c.cue.segment), c.t]);
    // Fixed-step ticks of 7ms: compare against ceil-to-tick time.
    const tickAt = (x: number) => Math.ceil(x / 7) * 7;
    expect(got).toEqual([
      [1, tickAt(b[2] - 10_000)],
      [2, tickAt(b[3] - 10_000)],
    ]);
  });

  it('halfway only for work segments >= 60s', () => {
    const segs = [seg(59_000), seg(60_000), seg(120_000, 'rest'), seg(90_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(boundaries(segs).at(-1)!, 1);
    const b = boundaries(segs);
    expect(h.of('halfway').map((c) => [h.engine.getSegments().indexOf(c.cue.segment), c.t])).toEqual([
      [1, b[1] + 30_000],
      [3, b[3] + 45_000],
    ]);
  });

  it('minute cues: >= 3 min countdown segment, correct values, never at start or end', () => {
    const segs = [seg(179_000), seg(300_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(479_000, 50);
    const mins = h.of('minute');
    expect(mins.every((m) => m.cue.segment === h.engine.getSegments()[1])).toBe(true);
    expect(mins.map((m) => [m.t - 179_000, m.cue.minutesElapsed, m.cue.minutesRemaining])).toEqual([
      [60_000, 1, 4],
      [120_000, 2, 3],
      [180_000, 3, 2],
      [240_000, 4, 1],
    ]);
  });

  it('minute cues on a non-whole-minute countdown land when the clock shows whole minutes', () => {
    const h = harness([seg(210_000)]); // 3:30
    h.engine.start();
    h.run(210_000, 10);
    expect(h.of('minute').map((m) => [m.t, m.cue.minutesRemaining, m.cue.minutesElapsed])).toEqual([
      [30_000, 3, 0],
      [90_000, 2, 1],
      [150_000, 1, 2],
    ]);
    for (const m of h.of('minute')) {
      expect(formatClock(210_000 - m.t, { roundUp: true }).main).toBe(`${m.cue.minutesRemaining}:00`);
    }
  });

  it('minute cues on count-up segments (open and capped) count elapsed minutes', () => {
    const open = harness([seg(null)]);
    open.engine.start();
    open.run(200_000, 25);
    expect(open.of('minute').map((m) => [m.t, m.cue.minutesElapsed, m.cue.minutesRemaining])).toEqual([
      [60_000, 1, null],
      [120_000, 2, null],
      [180_000, 3, null],
    ]);
    const capped = harness(compile({ mode: 'fortime', capSec: 240, targetRounds: 0 }, 0));
    capped.engine.start();
    capped.run(240_000, 25);
    expect(capped.of('minute').map((m) => [m.t, m.cue.minutesElapsed, m.cue.minutesRemaining])).toEqual([
      [60_000, 1, 3],
      [120_000, 2, 2],
      [180_000, 3, 1],
    ]);
  });

  it('no minute cues in prep or in short segments', () => {
    const h = harness([seg(240_000, 'prep'), seg(120_000)]);
    h.engine.start();
    h.run(360_000, 100);
    expect(h.of('minute')).toHaveLength(0);
  });

  it('cue emission is idempotent under repeated tick() at the same time', () => {
    const h = harness([seg(5_000, 'prep'), seg(200_000)]);
    h.engine.start();
    for (let t = 0; t <= 205_000; t += 250) {
      for (let k = 0; k < 4; k++) h.at(t);
    }
    const ref = harness([seg(5_000, 'prep'), seg(200_000)]);
    ref.engine.start();
    for (let t = 0; t <= 205_000; t += 250) ref.at(t);
    expect(h.log).toEqual(ref.log);
    expect(h.of('finish')).toHaveLength(1);
  });

  it('segment cues carry index and previous', () => {
    const segs = [seg(2_000, 'prep'), seg(3_000), seg(3_000, 'rest')];
    const h = harness(segs);
    h.engine.start();
    h.run(8_000, 10);
    const s = h.of('segment');
    expect(s.map((c) => [c.cue.index, c.cue.segment.kind, c.cue.previous.kind, c.t])).toEqual([
      [1, 'work', 'prep', 2_000],
      [2, 'rest', 'work', 5_000],
    ]);
  });
});

// ----------------------------------------------------------------- controls

describe('controls', () => {
  it('next() skips the rest of a segment; on the last segment it finishes', () => {
    const segs = [seg(10_000), seg(10_000, 'rest'), seg(10_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(3_000);
    h.engine.next();
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 0, totalElapsedMs: 3_000 });
    expect(h.of('segment')).toHaveLength(1);
    h.run(13_000 - 1); // rest ends at 3s + 10s
    expect(h.engine.snapshot().segmentIndex).toBe(1);
    h.at(13_000);
    expect(h.engine.snapshot().segmentIndex).toBe(2);
    // overall progress follows the plan position, not wall time
    h.at(15_000);
    expect(h.engine.snapshot().overallProgress).toBeCloseTo(22_000 / 30_000, 10);
    h.engine.next();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 15_000 });
    expect(h.of('finish')).toHaveLength(1);
    h.engine.next();
    expect(h.of('finish')).toHaveLength(1);
  });

  it('next() is a no-op while idle', () => {
    const h = harness([seg(10_000), seg(10_000)]);
    h.engine.next();
    expect(h.engine.snapshot().segmentIndex).toBe(0);
  });

  it('next() past prep sets workStart at the skip instant', () => {
    const h = harness([seg(10_000, 'prep'), seg(60_000)]);
    h.engine.start();
    h.run(4_000);
    expect(h.engine.snapshot().workElapsedMs).toBe(0);
    h.engine.next();
    h.run(10_000);
    expect(h.engine.snapshot()).toMatchObject({ workElapsedMs: 6_000, totalElapsedMs: 10_000 });
  });

  it('next() when a segment end already passed (no tick) does not skip an extra segment', () => {
    const h = harness([seg(5_000), seg(5_000), seg(5_000)]);
    h.engine.start();
    h.set(5_200);
    h.engine.next(); // timeline is in segment 1 already → skip to 2
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 2, segmentElapsedMs: 0, totalElapsedMs: 5_200 });
  });

  it('next() while paused works and timing stays consistent', () => {
    const h = harness([seg(10_000), seg(10_000), seg(10_000)]);
    h.engine.start();
    h.run(4_000);
    h.engine.pause();
    h.set(50_000);
    h.engine.next();
    expect(h.engine.snapshot()).toMatchObject({ status: 'paused', segmentIndex: 1, segmentElapsedMs: 0, totalElapsedMs: 4_000 });
    h.engine.resume();
    h.run(50_000 + 9_999, 10);
    expect(h.engine.snapshot().segmentIndex).toBe(1);
    h.at(60_000);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 2, segmentElapsedMs: 0, totalElapsedMs: 14_000 });
    // Countdown for segment 1 fired exactly once.
    expect(h.of('countdown').filter((c) => c.cue.segment === h.engine.getSegments()[1])).toHaveLength(3);
    // next() on the last segment while paused finishes
    h.engine.pause();
    h.engine.next();
    h.engine.next();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 14_000 });
  });

  it('previous(): restarts current segment, or goes back within the first 2s', () => {
    const segs = [seg(10_000), seg(10_000, 'rest'), seg(10_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(15_000);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 5_000 });
    h.engine.previous(); // > 2s in → restart
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 0, totalElapsedMs: 15_000 });
    h.run(16_500);
    h.engine.previous(); // < 2s in → back to 0
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 0, segmentElapsedMs: 0 });
    h.run(16_500 + 1_000);
    h.engine.previous(); // first segment, < 2s → restart, can't go further
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 0, segmentElapsedMs: 0 });
    // The restarted segment runs its full length with all its cues.
    const before = h.of('countdown').length;
    h.run(17_500 + 10_000, 10);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 0 });
    expect(h.of('countdown').length - before).toBe(3);
  });

  it('previous() back into prep resets workStart', () => {
    const h = harness([seg(5_000, 'prep'), seg(60_000)]);
    h.engine.start();
    h.run(6_000);
    expect(h.engine.snapshot().workElapsedMs).toBe(1_000);
    h.engine.previous();
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 0, workElapsedMs: 0 });
    h.run(8_000);
    expect(h.engine.snapshot().workElapsedMs).toBe(0);
    h.run(11_000 + 250, 33);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, workElapsedMs: 250 });
    h.run(71_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', workElapsedMs: 60_000, totalElapsedMs: 71_000 });
  });

  it('previous() emits a segment cue (UI announces the restarted segment)', () => {
    const h = harness([seg(10_000), seg(10_000)]);
    h.engine.start();
    h.run(12_500);
    h.engine.previous();
    const last = h.of('segment').at(-1)!;
    expect(last.cue.index).toBe(1);
  });

  it('prep→work boundary sets workStart exactly even when the tick lands late', () => {
    const h = harness([seg(10_000, 'prep'), seg(60_000)]);
    h.engine.start();
    h.at(9_000);
    h.at(10_873);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, workElapsedMs: 873, segmentElapsedMs: 873 });
    h.at(30_000);
    expect(h.engine.snapshot().workElapsedMs).toBe(20_000);
  });

  it('workElapsed excludes prep; equals total when there is no prep', () => {
    const h = harness([seg(60_000)]);
    h.engine.start();
    h.run(12_000);
    expect(h.engine.snapshot()).toMatchObject({ workElapsedMs: 12_000, totalElapsedMs: 12_000 });
  });

  it('adjustCurrent: +/- time, never below elapsed + 1s', () => {
    const h = harness([seg(30_000), seg(10_000)]);
    h.engine.start();
    h.run(10_000);
    h.engine.adjustCurrent(15_000);
    expect(h.engine.snapshot()).toMatchObject({ segmentRemainingMs: 35_000, plannedWorkMs: 55_000 });
    h.engine.adjustCurrent(-60_000);
    expect(h.engine.snapshot()).toMatchObject({ segmentRemainingMs: 1_000, plannedWorkMs: 21_000 });
    h.run(11_000 - 1);
    expect(h.engine.snapshot().segmentIndex).toBe(0);
    h.at(11_000);
    expect(h.engine.snapshot().segmentIndex).toBe(1);
    h.run(21_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 21_000, workElapsedMs: 21_000 });
  });

  it('adjustCurrent while paused and while idle; ignored on open-ended', () => {
    const h = harness([seg(30_000), seg(null)]);
    h.engine.adjustCurrent(-25_000);
    expect(h.engine.snapshot().segmentRemainingMs).toBe(5_000);
    h.engine.adjustCurrent(-25_000);
    expect(h.engine.snapshot().segmentRemainingMs).toBe(1_000);
    h.engine.adjustCurrent(29_000);
    h.engine.start();
    h.run(20_000);
    h.engine.pause();
    h.set(100_000);
    h.engine.adjustCurrent(-60_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'paused', segmentRemainingMs: 1_000 });
    h.engine.resume();
    h.at(101_000);
    expect(h.engine.snapshot().segmentIndex).toBe(1);
    h.engine.adjustCurrent(10_000);
    expect(h.engine.snapshot().segment.durationMs).toBeNull();
  });

  it('adjustCurrent after the segment end passed (no tick yet) adjusts the segment on screen', () => {
    const h = harness([seg(10_000), seg(10_000)]);
    h.engine.start();
    h.set(10_500);
    h.engine.adjustCurrent(5_000);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, segmentElapsedMs: 500, segmentRemainingMs: 14_500 });
    expect(h.engine.getSegments()[0].durationMs).toBe(10_000);
  });

  it('adding time re-arms countdown cues', () => {
    const h = harness([seg(10_000)]);
    h.engine.start();
    h.run(8_500, 10);
    expect(h.of('countdown').map((c) => c.cue.n)).toEqual([3, 2]);
    h.engine.adjustCurrent(10_000);
    h.run(20_000, 10);
    expect(h.of('countdown').map((c) => [c.cue.n, c.t])).toEqual([
      [3, 7_000],
      [2, 8_000],
      [3, 17_000],
      [2, 18_000],
      [1, 19_000],
    ]);
  });

  it('lap() split math', () => {
    const h = harness([seg(5_000, 'prep'), seg(null)]);
    h.engine.lap();
    expect(h.engine.snapshot().laps).toHaveLength(0);
    h.engine.start();
    h.run(5_000 + 30_000);
    h.engine.lap();
    h.run(5_000 + 75_500);
    h.engine.lap();
    h.engine.pause();
    h.set(500_000);
    h.engine.lap(); // paused: lap at paused time
    expect(h.engine.snapshot().laps).toEqual([
      { index: 1, atMs: 30_000, splitMs: 30_000, segmentIndex: 1 },
      { index: 2, atMs: 75_500, splitMs: 45_500, segmentIndex: 1 },
      { index: 3, atMs: 75_500, splitMs: 0, segmentIndex: 1 },
    ]);
  });

  it('lap() when a boundary passed without a tick records the correct segment', () => {
    const h = harness([seg(10_000), seg(10_000)]);
    h.engine.start();
    h.set(12_000);
    h.engine.lap();
    expect(h.engine.snapshot().laps[0]).toMatchObject({ atMs: 12_000, segmentIndex: 1 });
  });

  it('tapRound / undoRound', () => {
    const h = harness([seg(600_000)]);
    h.engine.tapRound();
    expect(h.engine.snapshot().roundsTapped).toBe(0);
    h.engine.start();
    h.run(61_000);
    h.engine.tapRound();
    h.run(130_000);
    h.engine.tapRound();
    expect(h.engine.snapshot()).toMatchObject({ roundsTapped: 2, roundTapTimesMs: [61_000, 130_000] });
    h.engine.undoRound();
    expect(h.engine.snapshot()).toMatchObject({ roundsTapped: 1, roundTapTimesMs: [61_000] });
    h.engine.undoRound();
    h.engine.undoRound();
    expect(h.engine.snapshot().roundsTapped).toBe(0);
  });

  it('reset() returns to idle and restores original (un-adjusted) durations', () => {
    const segs = [seg(5_000, 'prep'), seg(30_000)];
    const h = harness(segs);
    h.engine.start();
    h.run(8_000);
    h.engine.adjustCurrent(60_000);
    h.engine.lap();
    h.engine.tapRound();
    h.engine.reset();
    const s = h.engine.snapshot();
    expect(s).toMatchObject({
      status: 'idle',
      segmentIndex: 0,
      totalElapsedMs: 0,
      workElapsedMs: 0,
      laps: [],
      roundsTapped: 0,
      plannedWorkMs: 30_000,
    });
    expect(h.engine.getSegments()[1].durationMs).toBe(30_000);
    // input segments are never mutated
    expect(segs[1].durationMs).toBe(30_000);
  });

  it('start() after finished resets and runs again from the beginning', () => {
    const h = harness([seg(3_000, 'prep'), seg(5_000)]);
    h.engine.start();
    h.run(4_000);
    h.engine.adjustCurrent(10_000);
    h.run(30_000, 50);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 18_000 });
    h.engine.start();
    expect(h.engine.snapshot()).toMatchObject({ status: 'running', segmentIndex: 0, totalElapsedMs: 0, workElapsedMs: 0 });
    expect(h.types().at(-1)).toBe('start');
    h.run(30_000 + 8_000, 50);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 8_000, workElapsedMs: 5_000 });
    expect(h.of('finish')).toHaveLength(2);
  });

  it('start() repeatedly while running is a no-op', () => {
    const h = harness([seg(10_000)]);
    h.engine.start();
    h.run(3_000);
    h.engine.start();
    h.engine.start();
    h.run(5_000);
    expect(h.engine.snapshot().totalElapsedMs).toBe(5_000);
    expect(h.types().filter((t) => t === 'start')).toHaveLength(1);
  });

  it('subscribe() is notified on discrete changes and can unsubscribe', () => {
    const h = harness([seg(1_000), seg(1_000)]);
    let n = 0;
    const off = h.engine.subscribe(() => n++);
    h.engine.start();
    expect(n).toBe(1);
    h.at(1_000);
    expect(n).toBe(2);
    off();
    h.at(2_000);
    expect(n).toBe(2);
  });

  it('a throwing cue handler never breaks timing', () => {
    let t = 0;
    const errors = console.error;
    console.error = () => {};
    try {
      const e = new TimerEngine([seg(5_000), seg(5_000)], {
        now: () => t,
        onCue: () => {
          throw new Error('boom');
        },
      });
      e.start();
      t = 10_000;
      expect(e.tick()).toMatchObject({ status: 'finished', totalElapsedMs: 10_000 });
    } finally {
      console.error = errors;
    }
  });
});

// --------------------------------------------------------------- edge cases

describe('edge cases', () => {
  it('constructor rejects empty segment list', () => {
    expect(() => new TimerEngine([])).toThrow();
  });

  it('custom config with zero-duration (untimed) steps only', () => {
    const segs = compile(
      {
        mode: 'custom',
        rounds: 2,
        restBetweenRoundsSec: 0,
        steps: [
          { id: 'a', label: 'Run', kind: 'work', durationSec: 0 },
          { id: 'b', label: 'Row', kind: 'work', durationSec: 0 },
        ],
      },
      0,
    );
    const h = harness(segs);
    h.engine.start();
    h.run(600_000, 1000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'running', segmentIndex: 0, plannedWorkMs: null, overallProgress: 0 });
    h.engine.next();
    h.engine.next();
    h.engine.next();
    h.run(700_000, 1000);
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 3, segmentElapsedMs: 100_000 });
    h.engine.next();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 700_000, workElapsedMs: 700_000 });
  });

  it('zero-length timed segments are passed through instantly', () => {
    const h = harness(compile({ mode: 'amrap', durationSec: 0, sets: 2, restBetweenSetsSec: 0 }, 0));
    h.engine.start();
    h.at(0);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 0, overallProgress: 1 });
  });

  it('overallProgress tracks plan position across prep, skips and restarts', () => {
    const h = harness([seg(10_000, 'prep'), seg(20_000), seg(20_000)]);
    h.engine.start();
    h.run(5_000);
    expect(h.engine.snapshot().overallProgress).toBe(0);
    h.run(20_000);
    expect(h.engine.snapshot().overallProgress).toBeCloseTo(0.25, 10);
    h.engine.previous(); // restart work 1 at 10s in
    expect(h.engine.snapshot().overallProgress).toBe(0);
    h.engine.next();
    expect(h.engine.snapshot().overallProgress).toBeCloseTo(0.5, 10);
  });

  it('every mode default runs to completion with exact final timing', () => {
    const configs: WorkoutConfig[] = [
      { mode: 'amrap', durationSec: 240, sets: 2, restBetweenSetsSec: 60 },
      { mode: 'emom', intervalSec: 60, rounds: 5, movements: ['A', 'Rest'] },
      { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 2, restBetweenSetsSec: 60, movements: [] },
      { mode: 'countdown', durationSec: 95 },
      { mode: 'deathby', intervalSec: 60, startReps: 1, increment: 1, maxRounds: 6, movement: 'Burpees' },
      {
        mode: 'custom',
        rounds: 3,
        restBetweenRoundsSec: 30,
        steps: [
          { id: 'a', label: 'A', kind: 'work', durationSec: 45 },
          { id: 'b', label: 'B', kind: 'rest', durationSec: 15 },
        ],
      },
    ];
    const r = rng(2024);
    for (const cfg of configs) {
      const segs = compile(cfg, 10);
      const h = harness(segs);
      h.engine.start();
      const total = boundaries(segs).at(-1)!;
      h.run(total + 5_000, () => 1 + Math.floor(r() * 250));
      expect(h.engine.snapshot(), cfg.mode).toMatchObject({
        status: 'finished',
        totalElapsedMs: total,
        workElapsedMs: total - 10_000,
        plannedWorkMs: total - 10_000,
        overallProgress: 1,
      });
      expect(h.of('segment').map((c) => c.cue.index)).toEqual(segs.slice(1).map((_, i) => i + 1));
      expect(h.of('finish')).toHaveLength(1);
    }
  });
});

// ------------------------------------------------------- review regressions

describe('review regressions', () => {
  it('A: previous() in a single-segment mode restarts the workout clock, laps and taps', () => {
    // Stopwatch / For Time: one open-ended work segment.
    const h = harness([seg(null)]);
    h.engine.start();
    h.run(30_000);
    h.engine.lap();
    h.engine.tapRound();
    h.run(40_000);
    h.engine.previous();
    expect(h.engine.snapshot()).toMatchObject({
      segmentElapsedMs: 0,
      workElapsedMs: 0,
      laps: [],
      roundsTapped: 0,
    });
    h.run(45_000);
    h.engine.lap();
    const s = h.engine.snapshot();
    expect(s.workElapsedMs).toBe(5_000);
    expect(s.segmentElapsedMs).toBe(5_000);
    expect(s.laps).toEqual([{ index: 1, atMs: 5_000, splitMs: 5_000, segmentIndex: 0 }]);
    h.engine.finish();
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', workElapsedMs: 5_000 });
  });

  it('A: previous() in a countdown with prep keeps elapsed + remaining consistent', () => {
    const h = harness([seg(5_000, 'prep'), seg(60_000)]);
    h.engine.start();
    h.run(25_000); // 20s into the countdown
    h.engine.previous();
    let s = h.engine.snapshot();
    expect(s).toMatchObject({ segmentIndex: 1, workElapsedMs: 0, remainingWorkMs: 60_000, segmentRemainingMs: 60_000 });
    h.run(35_000);
    s = h.engine.snapshot();
    expect(s.workElapsedMs + s.remainingWorkMs!).toBe(60_000);
    h.run(200_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', workElapsedMs: 60_000, totalElapsedMs: 85_000 });
  });

  it('A: remainingWorkMs follows the plan position after previous()/next() in multi-segment modes', () => {
    const h = harness([seg(20_000), seg(10_000, 'rest'), seg(20_000)]);
    expect(h.engine.snapshot().remainingWorkMs).toBe(50_000);
    h.engine.start();
    h.run(25_000); // 5s into rest
    expect(h.engine.snapshot().remainingWorkMs).toBe(25_000);
    h.engine.previous(); // restart rest
    expect(h.engine.snapshot()).toMatchObject({ remainingWorkMs: 30_000, workElapsedMs: 25_000 });
    h.engine.next(); // skip rest
    expect(h.engine.snapshot().remainingWorkMs).toBe(20_000);
    h.run(45_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', remainingWorkMs: 0 });
  });

  it('A: previous() later in a multi-segment workout keeps laps/taps and wall-clock work time', () => {
    const h = harness([seg(20_000), seg(20_000)]);
    h.engine.start();
    h.run(5_000);
    h.engine.tapRound();
    h.run(30_000);
    h.engine.previous(); // restart segment 2
    expect(h.engine.snapshot()).toMatchObject({ segmentIndex: 1, roundsTapped: 1, workElapsedMs: 30_000 });
  });

  it('B: a cue handler that calls tick() re-entrantly never double-fires cues', () => {
    let t = 0;
    const log: Cue[] = [];
    const e: TimerEngine = new TimerEngine([seg(10_000), seg(10_000)], {
      now: () => t,
      onCue: (c) => {
        log.push(c);
        e.tick();
        e.snapshot();
      },
    });
    e.start();
    for (t = 0; t <= 25_000; t += 16) e.tick();
    expect(log.filter((c) => c.type === 'countdown')).toHaveLength(6);
    expect(log.filter((c) => c.type === 'segment')).toHaveLength(1);
    expect(log.filter((c) => c.type === 'finish')).toHaveLength(1);
  });

  it('B: a subscriber that calls tick() re-entrantly never double-fires cues', () => {
    const h = harness([seg(5_000), seg(5_000), seg(5_000)]);
    h.engine.subscribe(() => h.engine.tick());
    h.engine.start();
    h.run(20_000, 16);
    expect(h.of('countdown')).toHaveLength(9);
    expect(h.of('segment')).toHaveLength(2);
    expect(h.of('finish')).toHaveLength(1);
  });

  it('B: a cue handler that pauses mid-advance stops the timeline where it paused', () => {
    let t = 0;
    const segs = [seg(5_000), seg(5_000), seg(5_000)];
    const e: TimerEngine = new TimerEngine(segs, {
      now: () => t,
      onCue: (c) => {
        if (c.type === 'segment') e.pause();
      },
    });
    e.start();
    t = 5_100;
    e.tick();
    t = 60_000;
    expect(e.tick()).toMatchObject({ status: 'paused', segmentIndex: 1, totalElapsedMs: 5_100 });
  });

  it('C: adjustCurrent() while idle adjusts the first work segment, not prep', () => {
    const h = harness([seg(10_000, 'prep'), seg(60_000), seg(30_000)]);
    h.engine.adjustCurrent(30_000);
    const segs = h.engine.getSegments();
    expect(segs.map((s) => s.durationMs)).toEqual([10_000, 90_000, 30_000]);
    expect(h.engine.snapshot().plannedWorkMs).toBe(120_000);
  });

  it('adjustCurrent() ignores non-finite deltas', () => {
    const h = harness([seg(30_000)]);
    h.engine.start();
    h.run(1_000);
    h.engine.adjustCurrent(NaN);
    h.engine.adjustCurrent(Infinity);
    expect(h.engine.snapshot()).toMatchObject({ segmentRemainingMs: 29_000, plannedWorkMs: 30_000 });
  });

  it('non-finite / negative segment durations never produce NaN', () => {
    const bad: Segment[] = [
      { kind: 'work', label: 'a', durationMs: NaN, direction: 'down' },
      { kind: 'work', label: 'b', durationMs: -5, direction: 'down' },
      { kind: 'work', label: 'c', durationMs: 5_000, direction: 'down' },
    ];
    const h = harness(bad);
    h.engine.start();
    h.run(2_000);
    const s = h.engine.snapshot();
    expect(s.segmentIndex).toBe(2);
    for (const v of [s.segmentElapsedMs, s.segmentProgress, s.overallProgress, s.workElapsedMs, s.plannedWorkMs]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    h.run(10_000);
    expect(h.engine.snapshot()).toMatchObject({ status: 'finished', totalElapsedMs: 5_000 });
  });

  it('long stopwatch sessions: hours display and minute markers stay correct', () => {
    const h = harness([seg(null)]);
    h.engine.start();
    h.run(2 * 3_600_000 + 5 * 60_000 + 9_000, 1_000);
    const s = h.engine.snapshot();
    expect(formatClock(s.segmentElapsedMs).main).toBe('2:05:09');
    expect(h.of('minute')).toHaveLength(125);
  });
});
