import { modeInfo } from '../../engine/modes';
import type { Segment, Snapshot, WorkoutConfig } from '../../engine/types';
import type { HistoryEntry } from '../../state/store';

/**
 * Rounds to record for a session:
 *  - AMRAP / For Time: what the athlete tapped.
 *  - Death By: fully completed intervals.
 *  - EMOM / intervals / custom: completed work intervals (or taps if any).
 */
export function roundsFor(
  config: WorkoutConfig,
  snap: Snapshot,
  segments: readonly Segment[],
  natural: boolean,
): number {
  if (config.mode === 'amrap' || config.mode === 'fortime') return snap.roundsTapped;
  if (snap.roundsTapped > 0) return snap.roundsTapped;
  const finishedAll = natural && snap.status === 'finished';
  if (config.mode === 'deathby') {
    if (finishedAll) return segments.filter((s) => s.kind === 'work').length;
    const r = snap.segment.round ?? 1;
    return Math.max(0, r - 1);
  }
  if (config.mode === 'emom' || config.mode === 'interval' || config.mode === 'tabata' || config.mode === 'custom') {
    const upto = finishedAll ? segments.length : snap.segmentIndex;
    if (config.mode === 'custom') {
      // completed rounds = round of the last fully-completed segment
      if (finishedAll) return Math.max(1, config.rounds);
      const cur = snap.segment.round ?? 1;
      return Math.max(0, cur - 1);
    }
    return segments.slice(0, upto).filter((s) => s.kind === 'work').length;
  }
  return 0;
}

export function buildEntry(
  config: WorkoutConfig,
  snap: Snapshot,
  segments: readonly Segment[],
  startedAt: number,
  completed: boolean,
  natural: boolean,
): Omit<HistoryEntry, 'id'> {
  return {
    name: config.name?.trim() || modeInfo(config.mode).title,
    mode: config.mode,
    config,
    startedAt,
    durationMs: Math.round(snap.workElapsedMs),
    completed,
    rounds: roundsFor(config, snap, segments, natural),
    roundTimesMs: snap.roundTapTimesMs.map((t) => Math.round(t)),
    laps: snap.laps.map((l) => ({ atMs: Math.round(l.atMs), splitMs: Math.round(l.splitMs) })),
  };
}
