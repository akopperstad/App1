import { describe, expect, it } from 'vitest';
import { compile } from '../engine/compile';
import type { Segment } from '../engine/types';
import { MAX_PENDING_ALERTS, alertTitle, planAlerts } from './schedule';

const tabata = compile(
  { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] },
  10,
);

describe('planAlerts', () => {
  it('schedules every boundary of a Tabata from the start of get-ready', () => {
    const plan = planAlerts(tabata, 0, 0);
    // 8 work + 7 rest + finish
    expect(plan).toHaveLength(16);
    expect(plan[0]).toMatchObject({ atMs: 10_000, title: 'Work — Round 1/8', kind: 'work', segmentIndex: 1 });
    expect(plan[1]).toMatchObject({ atMs: 30_000, title: 'Rest — 0:10', kind: 'rest' });
    expect(plan[1].body).toContain('Up next: Work — Round 2/8');
    expect(plan[14]).toMatchObject({ atMs: 10_000 + 7 * 30_000, title: 'Work — Round 8/8' });
    expect(plan[15]).toMatchObject({
      atMs: 10_000 + 8 * 20_000 + 7 * 10_000,
      title: 'Time!',
      body: 'Workout complete',
      kind: 'finish',
    });
  });

  it('counts from the current position inside a segment', () => {
    // Round 4 work (index 7: prep, w1, r1, w2, r2, w3, r3, w4), 5 s in.
    expect(tabata[7]).toMatchObject({ kind: 'work', round: 4 });
    const plan = planAlerts(tabata, 7, 5_000);
    expect(plan[0]).toMatchObject({ atMs: 15_000, title: 'Rest — 0:10' });
    expect(plan[1]).toMatchObject({ atMs: 25_000, title: 'Work — Round 5/8' });
    expect(plan.at(-1)).toMatchObject({ kind: 'finish', atMs: 15_000 + 4 * 30_000 });
  });

  it('honours adjusted durations and never goes negative', () => {
    const segs = tabata.map((s) => ({ ...s }));
    segs[1].durationMs = 45_000;
    expect(planAlerts(segs, 1, 0)[0].atMs).toBe(45_000);
    // Elapsed past the end (engine not yet advanced): the boundary is "now".
    expect(planAlerts(segs, 1, 60_000)[0].atMs).toBe(0);
  });

  it('stops at the first open-ended segment (announcing its start)', () => {
    const custom = compile(
      {
        mode: 'custom',
        rounds: 2,
        restBetweenRoundsSec: 0,
        steps: [
          { id: 'a', label: 'Row', kind: 'work', durationSec: 60 },
          { id: 'b', label: 'Burpees', kind: 'work', durationSec: 0 },
          { id: 'c', label: 'Rest', kind: 'rest', durationSec: 30 },
        ],
      },
      0,
    );
    const plan = planAlerts(custom, 0, 0);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ atMs: 60_000, title: 'Burpees — Round 1/2' });
    expect(plan[0].body).toContain('Tap Next');
    // Currently in the untimed step: nothing can be known.
    expect(planAlerts(custom, 1, 5_000)).toEqual([]);
  });

  it('a stopwatch / uncapped For Time schedules nothing', () => {
    expect(planAlerts(compile({ mode: 'stopwatch' }, 0), 0, 0)).toEqual([]);
    expect(planAlerts(compile({ mode: 'fortime', capSec: 0, targetRounds: 0 }, 10), 1, 0)).toEqual([]);
  });

  it('a single countdown ends with Time!', () => {
    const plan = planAlerts(compile({ mode: 'countdown', durationSec: 90 }, 0), 0, 30_000);
    expect(plan).toEqual([{ atMs: 60_000, title: 'Time!', body: 'Workout complete', kind: 'finish', segmentIndex: 1 }]);
  });

  it('caps the plan at the iOS pending-notification limit', () => {
    const emom = compile({ mode: 'emom', intervalSec: 30, rounds: 200, movements: [] }, 0);
    const plan = planAlerts(emom, 0, 0);
    expect(MAX_PENDING_ALERTS).toBe(64);
    expect(plan).toHaveLength(64);
    expect(plan[0]).toMatchObject({ atMs: 30_000, title: 'E0:30 — Round 2/200' });
    expect(plan.every((a, i) => i === 0 || a.atMs > plan[i - 1].atMs)).toBe(true);
    expect(planAlerts(emom, 0, 0, 5)).toHaveLength(5);
  });

  it('includes movement and set details in the body', () => {
    const segs = compile(
      { mode: 'interval', workSec: 40, restSec: 20, rounds: 2, sets: 2, restBetweenSetsSec: 60, movements: ['Swings'] },
      0,
    );
    const plan = planAlerts(segs, 0, 0);
    const set2 = plan.find((a) => a.kind === 'work' && a.body.includes('Set 2/2'));
    expect(set2?.body).toContain('Swings');
    expect(plan.some((a) => a.title.startsWith('Set rest — 1:00'))).toBe(true);
  });

  it('alertTitle falls back sensibly', () => {
    const seg: Segment = { kind: 'work', label: '', durationMs: null, direction: 'up' };
    expect(alertTitle(seg)).toBe('Work');
    expect(alertTitle({ ...seg, kind: 'rest', durationMs: 15_000 })).toBe('Rest — 0:15');
  });
});
