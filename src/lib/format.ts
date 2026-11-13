/**
 * Time formatting. Count-down displays round UP (so "0:03" is shown for the
 * whole third-to-last second and 0:00 only appears at the very end);
 * count-up displays round DOWN. This matches how every gym clock behaves.
 */

export interface ClockParts {
  /** e.g. "1:05:09", "12:04", "0:09" */
  main: string;
  /** tenths digit, e.g. "7" (only when requested) */
  tenths?: string;
}

export function formatClock(ms: number, opts: { roundUp?: boolean; tenths?: boolean } = {}): ClockParts {
  const safe = Math.max(0, ms);
  let totalSec: number;
  let tenths: string | undefined;
  if (opts.tenths && !opts.roundUp) {
    totalSec = Math.floor(safe / 1000);
    tenths = String(Math.floor((safe % 1000) / 100));
  } else if (opts.roundUp) {
    totalSec = Math.ceil(safe / 1000 - 1e-9);
  } else {
    totalSec = Math.floor(safe / 1000);
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const main = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return { main, tenths };
}

/** "1:23.4" or "1:23" */
export function formatClockString(ms: number, opts: { roundUp?: boolean; tenths?: boolean } = {}): string {
  const p = formatClock(ms, opts);
  return p.tenths !== undefined ? `${p.main}.${p.tenths}` : p.main;
}

/** Compact human duration: "20s", "1m 30s", "12 min", "1h 5m". */
export function formatDuration(sec: number): string {
  if (sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s ? `${m}m ${s}s` : `${m} min`;
  return `${s}s`;
}

/** "mm:ss" from seconds — for compact config summaries. */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
