import { formatDuration } from '../lib/format';
import type { Mode, WorkoutConfig } from './types';

export interface ModeInfo {
  mode: Mode;
  title: string;
  /** One-line explanation shown on the mode card. */
  tagline: string;
  /** CSS custom property name for this mode's accent colour. */
  accent: string;
  defaults: WorkoutConfig;
}

export const MODES: ModeInfo[] = [
  {
    mode: 'amrap',
    title: 'AMRAP',
    tagline: 'As many rounds as possible',
    accent: 'var(--mode-amrap)',
    defaults: { mode: 'amrap', durationSec: 12 * 60, sets: 1, restBetweenSetsSec: 60 },
  },
  {
    mode: 'emom',
    title: 'EMOM',
    tagline: 'Every minute on the minute',
    accent: 'var(--mode-emom)',
    defaults: { mode: 'emom', intervalSec: 60, rounds: 10, movements: [] },
  },
  {
    mode: 'fortime',
    title: 'For Time',
    tagline: 'Race the clock, with optional cap',
    accent: 'var(--mode-fortime)',
    defaults: { mode: 'fortime', capSec: 20 * 60, targetRounds: 0 },
  },
  {
    mode: 'tabata',
    title: 'Tabata',
    tagline: '20s on · 10s off · 8 rounds',
    accent: 'var(--mode-tabata)',
    defaults: {
      mode: 'tabata',
      workSec: 20,
      restSec: 10,
      rounds: 8,
      sets: 1,
      restBetweenSetsSec: 60,
      movements: [],
    },
  },
  {
    mode: 'interval',
    title: 'Intervals',
    tagline: 'Custom work / rest, rounds & sets',
    accent: 'var(--mode-interval)',
    defaults: {
      mode: 'interval',
      workSec: 40,
      restSec: 20,
      rounds: 10,
      sets: 1,
      restBetweenSetsSec: 90,
      movements: [],
    },
  },
  {
    mode: 'deathby',
    title: 'Death By',
    tagline: 'Add a rep every minute until you fail',
    accent: 'var(--mode-deathby)',
    defaults: {
      mode: 'deathby',
      intervalSec: 60,
      startReps: 1,
      increment: 1,
      maxRounds: 30,
      movement: 'Burpees',
    },
  },
  {
    mode: 'custom',
    title: 'Custom',
    tagline: 'Build any sequence of steps',
    accent: 'var(--mode-custom)',
    defaults: {
      mode: 'custom',
      rounds: 3,
      restBetweenRoundsSec: 0,
      steps: [
        { id: 's1', label: 'Run 400m', kind: 'work', durationSec: 0 },
        { id: 's2', label: 'Rest', kind: 'rest', durationSec: 90 },
      ],
    },
  },
  {
    mode: 'countdown',
    title: 'Countdown',
    tagline: 'Simple timer — rest, plank, holds',
    accent: 'var(--mode-countdown)',
    defaults: { mode: 'countdown', durationSec: 2 * 60 },
  },
  {
    mode: 'stopwatch',
    title: 'Stopwatch',
    tagline: 'Count up with laps & splits',
    accent: 'var(--mode-stopwatch)',
    defaults: { mode: 'stopwatch' },
  },
];

export function modeInfo(mode: Mode): ModeInfo {
  return MODES.find((m) => m.mode === mode)!;
}

/** Short human summary of a config, e.g. "12 min", "8 × 20s / 10s". */
export function describe(c: WorkoutConfig): string {
  switch (c.mode) {
    case 'amrap':
      return c.sets > 1
        ? `${c.sets} × ${formatDuration(c.durationSec)}` +
            (c.restBetweenSetsSec ? ` · ${formatDuration(c.restBetweenSetsSec)} rest` : '')
        : formatDuration(c.durationSec);
    case 'emom':
      return `${c.rounds} × ${formatDuration(c.intervalSec)}` +
        (c.movements.length ? ` · ${c.movements.filter(Boolean).length} movements` : '');
    case 'tabata':
    case 'interval':
      return (
        `${c.rounds} × ${formatDuration(c.workSec)} / ${formatDuration(c.restSec)}` +
        (c.sets > 1 ? ` · ${c.sets} sets` : '')
      );
    case 'fortime':
      return c.capSec > 0 ? `Cap ${formatDuration(c.capSec)}` : 'No cap';
    case 'countdown':
      return formatDuration(c.durationSec);
    case 'stopwatch':
      return 'Laps & splits';
    case 'deathby':
      return `${c.movement || 'Reps'} · +${c.increment} every ${formatDuration(c.intervalSec)}`;
    case 'custom':
      return `${c.steps.length} steps × ${c.rounds}`;
  }
}

/** Planned total seconds (excl. prep), or null when open-ended. */
export function totalSeconds(c: WorkoutConfig): number | null {
  switch (c.mode) {
    case 'amrap':
      return c.durationSec * c.sets + c.restBetweenSetsSec * Math.max(0, c.sets - 1);
    case 'emom':
      return c.intervalSec * c.rounds;
    case 'tabata':
    case 'interval': {
      const perSet = c.workSec * c.rounds + c.restSec * Math.max(0, c.rounds - 1);
      const between = c.sets > 1 ? (c.restBetweenSetsSec || c.restSec) * (c.sets - 1) : 0;
      return perSet * c.sets + between;
    }
    case 'fortime':
      return c.capSec > 0 ? c.capSec : null;
    case 'countdown':
      return c.durationSec;
    case 'stopwatch':
      return null;
    case 'deathby':
      return null;
    case 'custom': {
      if (c.steps.some((s) => s.durationSec === 0)) return null;
      const per = c.steps.reduce((a, s) => a + s.durationSec, 0);
      return per * c.rounds + c.restBetweenRoundsSec * Math.max(0, c.rounds - 1);
    }
  }
}

/** Built-in benchmark workouts users can start in one tap. */
export const BUILT_IN_PRESETS: { name: string; config: WorkoutConfig }[] = [
  { name: 'Cindy', config: { mode: 'amrap', durationSec: 20 * 60, sets: 1, restBetweenSetsSec: 0, name: 'Cindy' } },
  {
    name: 'Classic Tabata',
    config: { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 60, movements: [], name: 'Classic Tabata' },
  },
  {
    name: 'Fight Gone Bad',
    config: {
      mode: 'custom',
      name: 'Fight Gone Bad',
      rounds: 3,
      restBetweenRoundsSec: 0,
      steps: [
        { id: 'f1', label: 'Wall balls', kind: 'work', durationSec: 60 },
        { id: 'f2', label: 'Sumo DL high pull', kind: 'work', durationSec: 60 },
        { id: 'f3', label: 'Box jumps', kind: 'work', durationSec: 60 },
        { id: 'f4', label: 'Push press', kind: 'work', durationSec: 60 },
        { id: 'f5', label: 'Row (calories)', kind: 'work', durationSec: 60 },
        { id: 'f6', label: 'Rest', kind: 'rest', durationSec: 60 },
      ],
    },
  },
  {
    name: 'E2MOM × 10',
    config: { mode: 'emom', intervalSec: 120, rounds: 10, movements: [], name: 'E2MOM × 10' },
  },
  {
    name: 'Alternating EMOM',
    config: { mode: 'emom', intervalSec: 60, rounds: 20, movements: ['Strength', 'Burpees', 'Rest', 'Core'], name: 'Alternating EMOM' },
  },
  {
    name: '4 × 4 Norwegian',
    config: { mode: 'interval', workSec: 240, restSec: 180, rounds: 4, sets: 1, restBetweenSetsSec: 0, movements: [], name: '4 × 4 Norwegian' },
  },
  {
    name: 'Fran (cap 10)',
    config: { mode: 'fortime', capSec: 600, targetRounds: 3, name: 'Fran (cap 10)' },
  },
  {
    name: 'Death by Burpees',
    config: { mode: 'deathby', intervalSec: 60, startReps: 1, increment: 1, maxRounds: 30, movement: 'Burpees', name: 'Death by Burpees' },
  },
];
