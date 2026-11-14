import type { Segment } from '../engine/types';
import { EN, type Translator } from '../i18n/core';
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
export function alertTitle(seg: Segment, { t }: Translator = EN): string {
  const label = (seg.label || (seg.kind === 'rest' ? t('seg.rest') : t('seg.work'))).trim();
  if (seg.kind !== 'rest' && seg.round && seg.totalRounds && seg.totalRounds > 1) {
    return t('alert.round', { label, n: seg.round, total: seg.totalRounds });
  }
  if (seg.durationMs !== null && seg.durationMs > 0) return t('alert.timed', { label, time: mmss(seg.durationMs / 1000) });
  return label;
}

function alertBody(seg: Segment, next: Segment | undefined, tr: Translator): string {
  const { t } = tr;
  const parts: string[] = [];
  const detail = (seg.detail || '').trim();
  if (detail) parts.push(detail);
  if (seg.kind !== 'rest' && seg.round && seg.totalRounds && seg.totalRounds > 1 && seg.durationMs) {
    parts.push(mmss(seg.durationMs / 1000));
  }
  if (seg.set && seg.totalSets && seg.totalSets > 1) parts.push(t('alert.set', { n: seg.set, total: seg.totalSets }));
  if (seg.durationMs === null) parts.push(t('alert.tapNext'));
  else if (seg.kind === 'rest' && next) parts.push(t('alert.upNext', { what: alertTitle(next, tr) }));
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
 * Capped to `max` (iOS pending-notification limit). Texts use `tr` (default
 * English); segment labels are already in the workout's language.
 */
export function planAlerts(
  segments: readonly Segment[],
  index: number,
  segmentElapsedMs: number,
  max: number = MAX_PENDING_ALERTS,
  tr: Translator = EN,
): PlannedAlert[] {
  const out: PlannedAlert[] = [];
  const cur = segments[index];
  if (!cur || cur.durationMs === null || max <= 0) return out;

  let at = Math.max(0, cur.durationMs - Math.max(0, segmentElapsedMs));
  for (let i = index + 1; ; i++) {
    if (out.length >= max) break;
    const seg = segments[i];
    if (!seg) {
      out.push({ atMs: at, title: tr.t('alert.time'), body: tr.t('alert.complete'), kind: 'finish', segmentIndex: i });
      break;
    }
    out.push({
      atMs: at,
      title: alertTitle(seg, tr),
      body: alertBody(seg, segments[i + 1], tr),
      kind: seg.kind,
      segmentIndex: i,
    });
    if (seg.durationMs === null) break;
    at += seg.durationMs;
  }
  return out;
}
