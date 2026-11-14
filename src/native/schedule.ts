import type { Segment } from '../engine/types';
import { mmss } from '../lib/format';

/**
 * Background cue planning (pure, unit-tested).
 *
 * When the app is backgrounded / the phone is locked mid-workout, the web
 * view stops running JS (iOS) or may be throttled (Android), so in-app beeps
 * can't be relied on. Instead we pre-schedule one system notification per
 * upcoming segment boundary, computed from the engine's current position.
 */

/** iOS keeps at most 64 pending local notifications per app (extra ones are silently dropped). */
export const MAX_PENDING_ALERTS = 64;

export interface PlannedAlert {
  /** Milliseconds from "now" (the snapshot instant) until the boundary. */
  atMs: number;
  title: string;
  body: string;
  /** What starts at this boundary. */
  kind: 'work' | 'rest' | 'prep' | 'finish';
  /** Index of the segment that starts here (segments.length for the finish). */
  segmentIndex: number;
}

/** "Work — Round 4/8", "Rest — 0:10", "Burpees" (open-ended custom step). */
export function alertTitle(seg: Segment): string {
  const label = (seg.label || (seg.kind === 'rest' ? 'Rest' : 'Work')).trim();
  if (seg.kind !== 'rest' && seg.round && seg.totalRounds && seg.totalRounds > 1) {
    return `${label} — Round ${seg.round}/${seg.totalRounds}`;
  }
  if (seg.durationMs !== null && seg.durationMs > 0) return `${label} — ${mmss(seg.durationMs / 1000)}`;
  return label;
}

function alertBody(seg: Segment, next: Segment | undefined): string {
  const parts: string[] = [];
  const detail = (seg.detail || '').trim();
  if (detail) parts.push(detail);
  if (seg.kind !== 'rest' && seg.round && seg.totalRounds && seg.totalRounds > 1 && seg.durationMs) {
    parts.push(mmss(seg.durationMs / 1000));
  }
  if (seg.set && seg.totalSets && seg.totalSets > 1) parts.push(`Set ${seg.set}/${seg.totalSets}`);
  if (seg.durationMs === null) parts.push('Tap Next in Pulse when done');
  else if (seg.kind === 'rest' && next) parts.push(`Up next: ${alertTitle(next)}`);
  return parts.join(' · ');
}

/**
 * Alerts for every boundary after the current position.
 *
 * @param segments         the engine's (possibly adjusted) segment list
 * @param index            current segment index
 * @param segmentElapsedMs elapsed time in the current segment
 *
 * Stops at the first open-ended segment: its start is still announced, but
 * nothing after it is knowable. Ends with "Time!" when the plan runs out.
 * Capped to `max` (iOS pending-notification limit).
 */
export function planAlerts(
  segments: readonly Segment[],
  index: number,
  segmentElapsedMs: number,
  max: number = MAX_PENDING_ALERTS,
): PlannedAlert[] {
  const out: PlannedAlert[] = [];
  const cur = segments[index];
  if (!cur || cur.durationMs === null || max <= 0) return out;

  let at = Math.max(0, cur.durationMs - Math.max(0, segmentElapsedMs));
  for (let i = index + 1; ; i++) {
    if (out.length >= max) break;
    const seg = segments[i];
    if (!seg) {
      out.push({ atMs: at, title: 'Time!', body: 'Workout complete', kind: 'finish', segmentIndex: i });
      break;
    }
    out.push({
      atMs: at,
      title: alertTitle(seg),
      body: alertBody(seg, segments[i + 1]),
      kind: seg.kind,
      segmentIndex: i,
    });
    if (seg.durationMs === null) break;
    at += seg.durationMs;
  }
  return out;
}
