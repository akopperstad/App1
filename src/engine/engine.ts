import { plannedWorkMs } from './compile';
import type { Cue, Lap, Segment, Snapshot, TimerStatus } from './types';

export type Clock = () => number;

export interface EngineOptions {
  /** Monotonic clock in ms. Defaults to performance.now(). */
  now?: Clock;
  onCue?: (cue: Cue) => void;
}

/**
 * If more than this much time passes between ticks (tab backgrounded,
 * device asleep), we "catch up" silently: segment transitions still
 * happen, but stale countdown beeps are not replayed.
 */
const CATCH_UP_GAP_MS = 1500;

const defaultClock: Clock = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * Drift-free workout timer.
 *
 * Elapsed time is always computed as `accumulated + (now - runStart)`,
 * never by summing tick deltas, so it cannot drift no matter how
 * irregularly tick() is called. Segment boundaries are positions on that
 * elapsed timeline (`segStart`), so a late tick advances through any
 * number of segments correctly.
 */
export class TimerEngine {
  private segments: Segment[];
  private readonly now: Clock;
  private onCue?: (cue: Cue) => void;

  private status: TimerStatus = 'idle';
  private accumulated = 0;
  private runStart = 0;
  private segIndex = 0;
  /** Session elapsed ms at which the current segment started. */
  private segStart = 0;
  /** Session elapsed ms at which the prep segment ended (work started). */
  private workStart: number | null = null;
  private lastTickElapsed = 0;
  private laps: Lap[] = [];
  private roundTaps: number[] = [];
  private listeners = new Set<() => void>();

  constructor(segments: Segment[], opts: EngineOptions = {}) {
    if (segments.length === 0) throw new Error('TimerEngine needs at least one segment');
    this.segments = segments.map((s) => ({ ...s }));
    this.now = opts.now ?? defaultClock;
    this.onCue = opts.onCue;
    if (segments[0].kind !== 'prep') this.workStart = 0;
  }

  setCueHandler(fn: ((cue: Cue) => void) | undefined) {
    this.onCue = fn;
  }

  /** Subscribe to discrete state changes (status, segment, laps, taps). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getStatus(): TimerStatus {
    return this.status;
  }

  getSegments(): readonly Segment[] {
    return this.segments;
  }

  // ---------------------------------------------------------------- controls

  start() {
    if (this.status === 'running') return;
    if (this.status === 'finished') this.reset();
    const wasPaused = this.status === 'paused';
    this.runStart = this.now();
    this.status = 'running';
    if (wasPaused) {
      this.emit({ type: 'resume' });
    } else {
      this.emit({ type: 'start', segment: this.segments[this.segIndex], index: this.segIndex });
      if (this.segments[this.segIndex].kind !== 'prep') this.workStart ??= 0;
    }
    this.changed();
  }

  pause() {
    if (this.status !== 'running') return;
    this.tick();
    if (this.getStatus() !== 'running') return; // tick may have finished it
    this.accumulated = this.elapsed();
    this.status = 'paused';
    this.emit({ type: 'pause' });
    this.changed();
  }

  resume() {
    if (this.status === 'paused') this.start();
  }

  toggle() {
    if (this.status === 'running') this.pause();
    else this.start();
  }

  reset() {
    this.status = 'idle';
    this.accumulated = 0;
    this.runStart = 0;
    this.segIndex = 0;
    this.segStart = 0;
    this.lastTickElapsed = 0;
    this.workStart = this.segments[0].kind === 'prep' ? null : 0;
    this.laps = [];
    this.roundTaps = [];
    this.changed();
  }

  /** Jump to the next segment (skip rest, end an untimed step, ...). */
  next() {
    if (this.status === 'idle' || this.status === 'finished') return;
    this.tick();
    if (this.getStatus() === 'finished') return;
    const e = this.elapsed();
    this.advanceTo(this.segIndex + 1, e);
    this.lastTickElapsed = e;
    this.changed();
  }

  /**
   * Restart the current segment, or — if we're within the first 2 seconds
   * of it — go back to the previous one.
   */
  previous() {
    if (this.status === 'idle' || this.status === 'finished') return;
    this.tick();
    if (this.getStatus() === 'finished') return;
    const e = this.elapsed();
    const inSeg = e - this.segStart;
    const target = inSeg < 2000 && this.segIndex > 0 ? this.segIndex - 1 : this.segIndex;
    const prev = this.segments[this.segIndex];
    this.segIndex = target;
    this.segStart = e;
    if (this.segments[target].kind === 'prep') this.workStart = null;
    this.lastTickElapsed = e;
    this.emit({ type: 'segment', segment: this.segments[target], index: target, previous: prev });
    this.changed();
  }

  /** End the workout now (e.g. finished For Time, failed Death By). */
  finish() {
    if (this.status === 'idle' || this.status === 'finished') return;
    if (this.status === 'running') this.accumulated = this.elapsed();
    this.doFinish();
  }

  /**
   * Add (or remove, if negative) time to the current timed segment.
   * Never shortens a segment below what has already elapsed + 1s.
   */
  adjustCurrent(deltaMs: number) {
    const seg = this.segments[this.segIndex];
    if (seg.durationMs === null || this.status === 'finished') return;
    const inSeg = this.status === 'idle' ? 0 : this.elapsed() - this.segStart;
    seg.durationMs = Math.max(inSeg + 1000, seg.durationMs + deltaMs, 1000);
    this.changed();
  }

  /** Record a lap/split at the current time. */
  lap() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    const at = this.workElapsed(this.elapsed());
    const prev = this.laps.length ? this.laps[this.laps.length - 1].atMs : 0;
    this.laps = [
      ...this.laps,
      { index: this.laps.length + 1, atMs: at, splitMs: at - prev, segmentIndex: this.segIndex },
    ];
    this.changed();
  }

  /** Count a completed round (AMRAP / For Time). */
  tapRound() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.roundTaps = [...this.roundTaps, this.workElapsed(this.elapsed())];
    this.changed();
  }

  undoRound() {
    if (this.roundTaps.length === 0) return;
    this.roundTaps = this.roundTaps.slice(0, -1);
    this.changed();
  }

  // ------------------------------------------------------------------- tick

  /**
   * Advance the timeline to "now", emitting cues for any thresholds crossed
   * since the previous tick. Safe to call at any frequency.
   */
  tick(): Snapshot {
    if (this.status !== 'running') return this.snapshot();
    const e = this.elapsed();
    const gap = e - this.lastTickElapsed;
    const catchingUp = gap > CATCH_UP_GAP_MS;

    // Advance through any segments whose end we've passed.
    let transitioned = false;
    const from = this.segments[this.segIndex];
    for (;;) {
      const seg = this.segments[this.segIndex];
      if (seg.durationMs === null) break;
      const end = this.segStart + seg.durationMs;
      if (e < end) break;
      if (!catchingUp) this.emitCrossings(seg, this.lastTickElapsed, end);
      if (this.segIndex + 1 >= this.segments.length) {
        this.accumulated = end;
        this.runStart = this.now();
        this.doFinish();
        return this.snapshot();
      }
      this.segIndex++;
      this.segStart = end;
      if (this.workStart === null && this.segments[this.segIndex].kind !== 'prep') {
        this.workStart = end;
      }
      this.lastTickElapsed = Math.max(this.lastTickElapsed, end);
      transitioned = true;
    }
    if (transitioned) {
      this.emit({
        type: 'segment',
        segment: this.segments[this.segIndex],
        index: this.segIndex,
        previous: from,
      });
      this.changed();
    }

    if (!catchingUp) this.emitCrossings(this.segments[this.segIndex], this.lastTickElapsed, e);
    this.lastTickElapsed = e;
    return this.snapshot();
  }

  // --------------------------------------------------------------- snapshot

  snapshot(): Snapshot {
    const e = this.elapsed();
    const seg = this.segments[this.segIndex];
    let segElapsed = Math.max(0, e - this.segStart);
    if (seg.durationMs !== null) segElapsed = Math.min(segElapsed, seg.durationMs);
    const segRemaining = seg.durationMs === null ? null : Math.max(0, seg.durationMs - segElapsed);
    const planned = plannedWorkMs(this.segments);
    const work = this.workElapsed(e);
    return {
      status: this.status,
      segmentIndex: this.segIndex,
      segment: seg,
      segmentCount: this.segments.length,
      segmentElapsedMs: segElapsed,
      segmentRemainingMs: segRemaining,
      segmentProgress: seg.durationMs ? segElapsed / seg.durationMs : 0,
      totalElapsedMs: e,
      workElapsedMs: work,
      plannedWorkMs: planned,
      overallProgress:
        this.status === 'finished' ? 1 : planned ? Math.min(1, work / planned) : 0,
      next: this.segments[this.segIndex + 1] ?? null,
      laps: this.laps,
      roundsTapped: this.roundTaps.length,
      roundTapTimesMs: this.roundTaps,
    };
  }

  // ---------------------------------------------------------------- private

  private elapsed(): number {
    return this.status === 'running'
      ? this.accumulated + (this.now() - this.runStart)
      : this.accumulated;
  }

  private workElapsed(e: number): number {
    if (this.workStart === null) return 0;
    return Math.max(0, e - this.workStart);
  }

  private advanceTo(index: number, e: number) {
    const prev = this.segments[this.segIndex];
    if (index >= this.segments.length) {
      this.accumulated = e;
      if (this.status === 'running') this.runStart = this.now();
      this.doFinish();
      return;
    }
    this.segIndex = index;
    this.segStart = e;
    if (this.workStart === null && this.segments[index].kind !== 'prep') this.workStart = e;
    this.emit({ type: 'segment', segment: this.segments[index], index, previous: prev });
  }

  private doFinish() {
    if (this.status === 'running') {
      this.accumulated = this.elapsed();
    }
    this.status = 'finished';
    this.emit({ type: 'finish' });
    this.changed();
  }

  /** Emit threshold cues crossed in (fromE, toE] within `seg`. */
  private emitCrossings(seg: Segment, fromE: number, toE: number) {
    const start = this.segStart;
    const a = Math.max(0, fromE - start); // segment-elapsed before
    const b = toE - start; // segment-elapsed now
    if (b <= a) return;
    const dur = seg.durationMs;

    if (dur !== null) {
      const remA = dur - a;
      const remB = dur - b;
      // 3-2-1 countdown (only for segments long enough to make sense).
      for (const n of [3, 2, 1]) {
        const t = n * 1000;
        if (dur > t && remA > t && remB <= t) this.emit({ type: 'countdown', n, segment: seg });
      }
      if (dur >= 30_000 && remA > 10_000 && remB <= 10_000) {
        this.emit({ type: 'tenSeconds', segment: seg });
      }
      if (seg.kind === 'work' && dur >= 60_000 && a < dur / 2 && b >= dur / 2) {
        this.emit({ type: 'halfway', segment: seg });
      }
    }

    // Minute markers for long segments (>= 3 min or open-ended), not at 0 or end.
    if (seg.kind !== 'prep' && (dur === null || dur >= 180_000)) {
      const firstMin = Math.floor(a / 60_000) + 1;
      const lastMin = Math.floor(b / 60_000);
      for (let m = firstMin; m <= lastMin; m++) {
        const at = m * 60_000;
        if (dur !== null && at >= dur) break;
        this.emit({
          type: 'minute',
          minutesElapsed: m,
          minutesRemaining: dur === null ? null : Math.round((dur - at) / 60_000),
          segment: seg,
        });
      }
    }
  }

  private emit(cue: Cue) {
    try {
      this.onCue?.(cue);
    } catch (err) {
      console.error('cue handler failed', err);
    }
  }

  private changed() {
    this.listeners.forEach((l) => l());
  }
}
