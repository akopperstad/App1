import type { WorkoutConfig } from '../../engine/types';

const int = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

/** Clamp a config into a valid, runnable shape (never 0-length work, rounds ≥ 1). */
export function sanitize(c: WorkoutConfig): WorkoutConfig {
  switch (c.mode) {
    case 'amrap':
      return {
        ...c,
        durationSec: int(c.durationSec, 1, 6000),
        sets: int(c.sets, 1, 20),
        restBetweenSetsSec: int(c.restBetweenSetsSec, 0, 6000),
      };
    case 'emom':
      return { ...c, intervalSec: int(c.intervalSec, 1, 6000), rounds: int(c.rounds, 1, 999) };
    case 'tabata':
    case 'interval':
      return {
        ...c,
        workSec: int(c.workSec, 1, 6000),
        restSec: int(c.restSec, 0, 6000),
        rounds: int(c.rounds, 1, 999),
        sets: int(c.sets, 1, 20),
        restBetweenSetsSec: int(c.restBetweenSetsSec, 0, 6000),
      };
    case 'fortime':
      return { ...c, capSec: int(c.capSec, 0, 6000), targetRounds: int(c.targetRounds, 0, 999) };
    case 'countdown':
      return { ...c, durationSec: int(c.durationSec, 1, 6000) };
    case 'stopwatch':
      return c;
    case 'deathby':
      return {
        ...c,
        intervalSec: int(c.intervalSec, 1, 6000),
        startReps: int(c.startReps, 1, 999),
        increment: int(c.increment, 0, 99),
        maxRounds: int(c.maxRounds, 1, 999),
      };
    case 'custom':
      return {
        ...c,
        rounds: int(c.rounds, 1, 999),
        restBetweenRoundsSec: int(c.restBetweenRoundsSec, 0, 6000),
        steps: c.steps.map((s) => ({ ...s, durationSec: int(s.durationSec, 0, 6000) })),
      };
  }
}

/** Reasons the config can't be started yet (empty = OK). */
export function problems(c: WorkoutConfig): string[] {
  if (c.mode === 'custom' && c.steps.length === 0) return ['Add at least one step'];
  return [];
}
