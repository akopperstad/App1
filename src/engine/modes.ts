import { EN, isRestWord, type Key, type Translator } from '../i18n/core';
import { formatDuration } from '../lib/format';
import type { Mode, WorkoutConfig } from './types';

export interface ModeInfo {
  mode: Mode;
  /** English title (reference / fallback) — UI uses modeTitle(mode, tr). */
  title: string;
  /** English one-line explanation — UI uses modeTagline(mode, tr). */
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

/** Arrays in configs from storage may be missing (older versions) — never crash on them. */
function list<T>(v: T[] | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

/** Mode name in the user's language ("AMRAP", "Intervaller", "Stoppuhr"…). */
export function modeTitle(mode: Mode, tr: Translator = EN): string {
  return tr.t(`mode.${mode}` as Key);
}

/**
 * Display name for a saved session / record. Unnamed workouts are stored with
 * the English mode title ("Stopwatch"); show those in the user's language.
 */
export function entryTitle(name: string | undefined, mode: Mode, tr: Translator = EN): string {
  const n = (name ?? '').trim();
  return !n || n === modeInfo(mode).title ? modeTitle(mode, tr) : n;
}

/** One-line explanation for the mode card / configure header. */
export function modeTagline(mode: Mode, tr: Translator = EN): string {
  return tr.t(`modeTag.${mode}` as Key);
}

/**
 * Default config for a mode with user-visible default text (custom step
 * names) in the user's language.
 */
export function localizedDefaults(mode: Mode, tr: Translator = EN): WorkoutConfig {
  const d = modeInfo(mode).defaults;
  if (d.mode !== 'custom') return d;
  return {
    ...d,
    steps: d.steps.map((st) => ({
      ...st,
      label: isRestWord(st.label) ? tr.t('seg.rest') : st.label === 'Run 400m' ? tr.t('default.run400') : st.label,
    })),
  };
}

/** Short human summary of a config, e.g. "12 min", "8 × 20s / 10s" (in `tr`'s language). */
export function describe(c: WorkoutConfig, tr: Translator = EN): string {
  const { t, tp } = tr;
  const d = (sec: number) => formatDuration(sec, tr);
  switch (c.mode) {
    case 'amrap':
      return c.sets > 1
        ? `${c.sets} × ${d(c.durationSec)}` + (c.restBetweenSetsSec ? ` · ${t('desc.rest', { d: d(c.restBetweenSetsSec) })}` : '')
        : d(c.durationSec);
    case 'emom': {
      const n = list(c.movements).filter((m) => typeof m === 'string' && m.trim()).length;
      return `${c.rounds} × ${d(c.intervalSec)}` + (n ? ` · ${tp('desc.movements', n)}` : '');
    }
    case 'tabata':
    case 'interval':
      return `${c.rounds} × ${d(c.workSec)} / ${d(c.restSec)}` + (c.sets > 1 ? ` · ${tp('desc.sets', c.sets)}` : '');
    case 'fortime':
      return c.capSec > 0 ? t('desc.cap', { d: d(c.capSec) }) : t('desc.noCap');
    case 'countdown':
      return d(c.durationSec);
    case 'stopwatch':
      return t('desc.laps');
    case 'deathby':
      return t('desc.deathby', { move: c.movement || t('desc.reps'), n: c.increment, d: d(c.intervalSec) });
    case 'custom':
      return tp('desc.steps', list(c.steps).length, { rounds: c.rounds });
  }
}

/**
 * Planned total seconds (excl. prep), or null when open-ended.
 * Must always equal `plannedWorkMs(compile(c, 0)) / 1000` — mirrors compile()'s
 * clamping (rounds/sets >= 1, rests only when > 0). For Death By this is the
 * maximum length (all `maxRounds` intervals), since the engine plans for it.
 */
export function totalSeconds(c: WorkoutConfig): number | null {
  const pos = (n: number) => (n > 0 ? n : 0);
  switch (c.mode) {
    case 'amrap': {
      const sets = Math.max(1, c.sets);
      return c.durationSec * sets + pos(c.restBetweenSetsSec) * (sets - 1);
    }
    case 'emom':
      return c.intervalSec * Math.max(1, c.rounds);
    case 'tabata':
    case 'interval': {
      const rounds = Math.max(1, c.rounds);
      const sets = Math.max(1, c.sets);
      const perSet = c.workSec * rounds + pos(c.restSec) * (rounds - 1);
      const between = (c.restBetweenSetsSec > 0 ? c.restBetweenSetsSec : pos(c.restSec)) * (sets - 1);
      return perSet * sets + between;
    }
    case 'fortime':
      return c.capSec > 0 ? c.capSec : null;
    case 'countdown':
      return c.durationSec;
    case 'stopwatch':
      return null;
    case 'deathby':
      return c.intervalSec * Math.max(1, c.maxRounds);
    case 'custom': {
      const steps = list(c.steps).filter((s) => !!s && !(s.durationSec < 0));
      if (steps.length === 0 || steps.some((s) => !(s.durationSec > 0))) return null;
      const rounds = Math.max(1, c.rounds);
      const per = steps.reduce((a, s) => a + s.durationSec, 0);
      return per * rounds + pos(c.restBetweenRoundsSec) * (rounds - 1);
    }
  }
}

/**
 * Built-in benchmark workouts users can start in one tap. `nameKey` marks the
 * descriptive names that are translated (see benchName); hero / girl WODs
 * ("Cindy", "Fran", "Fight Gone Bad") are proper names and stay as they are.
 */
export const BUILT_IN_PRESETS: { name: string; nameKey?: Key; config: WorkoutConfig }[] = [
  { name: 'Cindy', config: { mode: 'amrap', durationSec: 20 * 60, sets: 1, restBetweenSetsSec: 0, name: 'Cindy' } },
  {
    name: 'Classic Tabata',
    nameKey: 'bench.classicTabata',
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
    nameKey: 'bench.altEmom',
    config: { mode: 'emom', intervalSec: 60, rounds: 20, movements: ['Strength', 'Burpees', 'Rest', 'Core'], name: 'Alternating EMOM' },
  },
  {
    name: '4 × 4 Norwegian',
    nameKey: 'bench.norwegian',
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

/** A benchmark's display name in the user's language. */
export function benchName(b: (typeof BUILT_IN_PRESETS)[number], tr: Translator = EN): string {
  return b.nameKey ? tr.t(b.nameKey) : b.name;
}

/** A benchmark's config with its name localized (what Configure / Run / History show). */
export function benchConfig(b: (typeof BUILT_IN_PRESETS)[number], tr: Translator = EN): WorkoutConfig {
  return { ...b.config, name: benchName(b, tr) };
}
