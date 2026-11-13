import { formatClock, formatClockString } from '../../lib/format';
import type { Segment, Snapshot, WorkoutConfig } from '../../engine/types';
import type { Settings } from '../../state/store';

export type Phase = 'idle' | 'prep' | 'work' | 'rest' | 'done';

export interface ClockModel {
  main: string;
  tenths?: string;
  /** Approximate rendered width in `em`, used to size the digits so they fill the space. */
  em: number;
  /** Seconds remaining (3, 2, 1) while in the final countdown of a timed segment, else 0. */
  final: number;
  /** Whether the display counts down. */
  down: boolean;
}

const DIGIT_EM = 0.6;
const COLON_EM = 0.3;
const TENTHS_EM = 0.45;

/** Estimate width (in em) of a clock string like "12:04" or "1:05:09". */
function widthEm(main: string, tenths: boolean): number {
  let em = 0;
  for (const ch of main) em += ch === ':' ? COLON_EM : DIGIT_EM;
  return em + (tenths ? TENTHS_EM : 0);
}

/** Width template so a segment's digits never resize while it runs. */
function templateFor(seg: Segment, down: boolean, elapsedMs: number): string {
  if (down && seg.durationMs !== null) {
    return formatClock(seg.durationMs, { roundUp: true }).main.replace(/\d/g, '0');
  }
  const max = Math.max(elapsedMs, seg.durationMs ?? 0, 600_000 - 1); // at least "00:00"
  return formatClock(max).main.replace(/\d/g, '0');
}

/** Whether this segment should display time remaining. */
export function countsDown(seg: Segment, config: WorkoutConfig, settings: Settings): boolean {
  if (seg.durationMs === null) return false;
  if (seg.direction === 'up') return false;
  if (seg.kind === 'work' && (config.mode === 'amrap' || config.mode === 'countdown')) {
    return settings.countDownDisplay;
  }
  return true;
}

export function clockModel(
  snap: Snapshot,
  config: WorkoutConfig,
  settings: Settings,
  idleSegment: Segment,
): ClockModel {
  const idle = snap.status === 'idle';
  const seg = idle ? idleSegment : snap.segment;
  const down = countsDown(seg, config, settings);
  const elapsed = idle ? 0 : snap.segmentElapsedMs;
  const remaining = idle ? (seg.durationMs ?? 0) : (snap.segmentRemainingMs ?? 0);
  const tenths = !down && settings.showTenths;
  const parts = down ? formatClock(remaining, { roundUp: true }) : formatClock(elapsed, { tenths });
  const tpl = templateFor(seg, down, elapsed);
  const final =
    snap.status === 'running' && seg.durationMs !== null && snap.segmentRemainingMs !== null
      ? snap.segmentRemainingMs > 0 && snap.segmentRemainingMs <= 3000
        ? Math.ceil(snap.segmentRemainingMs / 1000)
        : 0
      : 0;
  return {
    main: parts.main,
    tenths: parts.tenths,
    em: widthEm(tpl.length >= parts.main.length ? tpl : parts.main, tenths),
    final,
    down,
  };
}

export function phaseOf(snap: Snapshot): Phase {
  if (snap.status === 'idle') return 'idle';
  if (snap.status === 'finished') return 'done';
  return snap.segment.kind;
}

export function phaseLabel(seg: Segment): string {
  if (seg.kind === 'prep') return 'Get ready';
  return seg.label;
}

/** "Round 3 / 8 · Set 1 / 2" */
export function roundInfo(seg: Segment, config: WorkoutConfig): string {
  const parts: string[] = [];
  if (seg.round !== undefined) {
    if (config.mode === 'deathby') parts.push(`Round ${seg.round}`);
    else if (seg.totalRounds && seg.totalRounds > 1) parts.push(`Round ${seg.round} / ${seg.totalRounds}`);
  }
  if (seg.set !== undefined && seg.totalSets && seg.totalSets > 1) {
    parts.push(`Set ${seg.set} / ${seg.totalSets}`);
  }
  return parts.join(' · ');
}

/** Short label for a segment, for "Next up". */
export function segmentShort(seg: Segment): string {
  const name =
    seg.kind === 'prep'
      ? 'Get ready'
      : seg.detail && seg.kind === 'work' && !/^Next:/.test(seg.detail)
        ? seg.detail
        : seg.label;
  return name;
}

export function segmentTime(seg: Segment): string {
  return seg.durationMs === null ? 'open' : formatClock(seg.durationMs, { roundUp: true }).main;
}

/** Value (0..1) the ring should show. Down: remaining fraction; up: progress to cap or within the minute. */
export function ringValue(snap: Snapshot, config: WorkoutConfig, settings: Settings, idleSegment: Segment): number {
  if (snap.status === 'idle') return countsDown(idleSegment, config, settings) ? 1 : 0;
  if (snap.status === 'finished') return 1;
  const seg = snap.segment;
  if (seg.durationMs) {
    const p = Math.min(1, snap.segmentElapsedMs / seg.durationMs);
    return countsDown(seg, config, settings) ? 1 - p : p;
  }
  return (snap.segmentElapsedMs % 60_000) / 60_000;
}

export function announceFor(seg: Segment, config: WorkoutConfig): string {
  const bits = [phaseLabel(seg)];
  if (seg.detail) bits.push(seg.detail);
  const info = roundInfo(seg, config);
  if (info) bits.push(info.replace(/ \/ /g, ' of '));
  if (seg.durationMs !== null) bits.push(formatClockString(seg.durationMs, { roundUp: true }));
  return bits.join('. ');
}

/** First non-prep segment: what the idle screen previews. */
export function firstWork(segments: readonly Segment[]): Segment {
  return segments.find((s) => s.kind !== 'prep') ?? segments[0];
}

/** Stable key: changes only when something visible (outside the rAF-painted ring/bars) changes. */
export function displayKey(snap: Snapshot, config: WorkoutConfig, settings: Settings, idleSegment: Segment): string {
  const c = clockModel(snap, config, settings, idleSegment);
  return [
    snap.status,
    snap.segmentIndex,
    c.main,
    c.tenths ?? '',
    c.final,
    Math.floor(snap.workElapsedMs / 1000),
    snap.laps.length,
    snap.roundsTapped,
    snap.segment.durationMs ?? 'n',
    snap.plannedWorkMs ?? 'n',
  ].join('|');
}
