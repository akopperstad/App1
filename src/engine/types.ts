/**
 * Core contracts for Pulse Timer.
 *
 * Every workout configuration is compiled into a flat list of `Segment`s
 * (see compile.ts). The engine (engine.ts) only ever deals with segments,
 * which keeps timing logic in one place and makes every mode behave
 * identically with respect to pause/resume, skipping, cues, and background
 * catch-up.
 */

export type Mode =
  | 'amrap'
  | 'emom'
  | 'tabata'
  | 'interval'
  | 'fortime'
  | 'countdown'
  | 'stopwatch'
  | 'deathby'
  | 'custom';

interface BaseConfig {
  /** Optional user-facing name ("Cindy", "Morning Tabata"...). */
  name?: string;
}

/** As Many Rounds As Possible. Optionally several AMRAPs with rest between. */
export interface AmrapConfig extends BaseConfig {
  mode: 'amrap';
  /** Length of each AMRAP block, seconds. */
  durationSec: number;
  /** Number of AMRAP blocks (default 1). */
  sets: number;
  /** Rest between AMRAP blocks, seconds. */
  restBetweenSetsSec: number;
}

/** Every Minute On the Minute (or every N seconds: E2MOM, E90s...). */
export interface EmomConfig extends BaseConfig {
  mode: 'emom';
  /** Length of each interval, seconds (60 = EMOM, 120 = E2MOM...). */
  intervalSec: number;
  /** Number of intervals. */
  rounds: number;
  /**
   * Optional movement labels that rotate each round
   * (e.g. ["Burpees", "Squats", "Rest"]).
   */
  movements: string[];
}

/** Work/rest intervals. Tabata is the 20/10 x 8 preset of this shape. */
export interface IntervalConfig extends BaseConfig {
  mode: 'interval' | 'tabata';
  workSec: number;
  restSec: number;
  rounds: number;
  /** Repeat the whole rounds block this many times (default 1). */
  sets: number;
  restBetweenSetsSec: number;
  /** Optional movement labels that rotate per work round. */
  movements: string[];
}

/** Count-up as fast as possible, with an optional time cap. */
export interface ForTimeConfig extends BaseConfig {
  mode: 'fortime';
  /** Time cap in seconds, or 0 for no cap. */
  capSec: number;
  /** Target number of rounds (0 = not tracked) — purely for the round counter UI. */
  targetRounds: number;
}

/** Simple countdown (rest timer, plank, etc). */
export interface CountdownConfig extends BaseConfig {
  mode: 'countdown';
  durationSec: number;
}

/** Open stopwatch with laps. */
export interface StopwatchConfig extends BaseConfig {
  mode: 'stopwatch';
}

/**
 * Death By: interval N requires N reps. Continues until the athlete
 * fails (taps Finish) or `maxRounds` is reached.
 */
export interface DeathByConfig extends BaseConfig {
  mode: 'deathby';
  intervalSec: number;
  /** Starting rep count (usually 1). */
  startReps: number;
  /** Reps added per interval (usually 1). */
  increment: number;
  maxRounds: number;
  movement: string;
}

export type StepKind = 'work' | 'rest';

export interface CustomStep {
  id: string;
  label: string;
  kind: StepKind;
  /** Duration in seconds; 0 means "untimed" — counts up until the user taps Next. */
  durationSec: number;
}

/** Fully custom sequence of steps, repeated `rounds` times. */
export interface CustomConfig extends BaseConfig {
  mode: 'custom';
  steps: CustomStep[];
  rounds: number;
  restBetweenRoundsSec: number;
}

export type WorkoutConfig =
  | AmrapConfig
  | EmomConfig
  | IntervalConfig
  | ForTimeConfig
  | CountdownConfig
  | StopwatchConfig
  | DeathByConfig
  | CustomConfig;

export type SegmentKind = 'prep' | 'work' | 'rest';

/**
 * What a segment *is*, independent of the (translated) label text — so speech,
 * notifications and the run screen never have to parse labels.
 *  - prep: get-ready lead-in
 *  - amrap / emom / work (interval & Tabata work) / fortime / countdown /
 *    stopwatch / deathby: built-in work segments
 *  - rest (between intervals, EMOM rest minute, custom "Rest" step),
 *    setRest / roundRest / amrapRest: rests whose `detail` says what's next
 *  - step: custom step with the user's own label
 *  - open: fallback open-ended segment for an empty plan
 */
export type SegmentType =
  | 'prep'
  | 'amrap'
  | 'amrapRest'
  | 'emom'
  | 'work'
  | 'rest'
  | 'setRest'
  | 'roundRest'
  | 'fortime'
  | 'countdown'
  | 'stopwatch'
  | 'deathby'
  | 'step'
  | 'open';

export interface Segment {
  kind: SegmentKind;
  /** Set by compile(); optional so hand-built / stored segments stay valid. */
  type?: SegmentType;
  /** Big label in the workout's language, e.g. "Work", "Pause", "Get ready", "AMRAP". */
  label: string;
  /** Secondary text, e.g. movement name or "20 reps". */
  detail?: string;
  /**
   * Duration in ms. `null` = open-ended: counts up until the user advances
   * (stopwatch, For Time with no cap, untimed custom step).
   */
  durationMs: number | null;
  /** Whether the main display should count down or up for this segment. */
  direction: 'down' | 'up';
  /** 1-based round within the current set (undefined for prep). */
  round?: number;
  totalRounds?: number;
  /** 1-based set index. */
  set?: number;
  totalSets?: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface Lap {
  /** 1-based index. */
  index: number;
  /** Elapsed workout time (excl. prep) when the lap was recorded. */
  atMs: number;
  /** Duration of this lap (since previous lap). */
  splitMs: number;
  /** Segment index the lap was recorded in. */
  segmentIndex: number;
}

export interface Snapshot {
  status: TimerStatus;
  segmentIndex: number;
  segment: Segment;
  segmentCount: number;
  /** Elapsed ms in current segment. */
  segmentElapsedMs: number;
  /** Remaining ms in current segment (null if open-ended). */
  segmentRemainingMs: number | null;
  /** 0..1 progress of current segment (0 for open-ended). */
  segmentProgress: number;
  /** Elapsed ms in the whole session including prep. */
  totalElapsedMs: number;
  /** Elapsed ms excluding the prep segment — "workout time". */
  workElapsedMs: number;
  /** Total planned duration (excl. prep), or null if any segment is open-ended. */
  plannedWorkMs: number | null;
  /** 0..1 overall progress (excl. prep), 0 if unknown. */
  overallProgress: number;
  /**
   * Planned work time still ahead (excl. prep) based on the plan position —
   * stays consistent after next()/previous()/adjustCurrent(). null if open-ended.
   */
  remainingWorkMs: number | null;
  /** Next segment, if any. */
  next: Segment | null;
  laps: Lap[];
  /** User-tapped round counter (AMRAP / For Time). */
  roundsTapped: number;
  /** Elapsed workout time of each round tap — for splits. */
  roundTapTimesMs: number[];
}

/**
 * Cue events, emitted once per crossing by the engine's tick().
 * The audio layer maps these to beeps / speech / vibration.
 */
export type Cue =
  | { type: 'start'; segment: Segment; index: number }
  | { type: 'segment'; segment: Segment; index: number; previous: Segment }
  /** n = seconds remaining (3, 2, 1) in a timed segment. */
  | { type: 'countdown'; n: number; segment: Segment }
  | { type: 'halfway'; segment: Segment }
  /** Fires when 10 seconds remain in a timed segment that is >= 30s long. */
  | { type: 'tenSeconds'; segment: Segment }
  /** Fires every full minute of workout time in long segments (>= 3 min). value = minutes elapsed or remaining. */
  | { type: 'minute'; minutesRemaining: number | null; minutesElapsed: number; segment: Segment }
  | { type: 'finish' }
  | { type: 'pause' }
  | { type: 'resume' };
