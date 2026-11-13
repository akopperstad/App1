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
  // Work in whole tenths / seconds first so the seconds and tenths digits can
  // never disagree, and so float noise (e.g. 2999.9999999) can't flip a digit.
  // The 1e-6 epsilon is far below anything a human can perceive.
  if (opts.tenths) {
    const t = opts.roundUp ? Math.ceil(safe / 100 - 1e-6) : Math.floor(safe / 100 + 1e-6);
    totalSec = Math.floor(t / 10);
    tenths = String(t % 10);
  } else if (opts.roundUp) {
    totalSec = Math.ceil(safe / 1000 - 1e-6);
  } else {
    totalSec = Math.floor(safe / 1000 + 1e-6);
  }
  totalSec = Math.max(0, totalSec);
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
  sec = Math.round(sec); // round first: 59.6 must give "1 min", not "60s"
  if (sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s ? `${m}m ${s}s` : `${m} min`;
  return `${s}s`;
}

/** "mm:ss" from seconds — for compact config summaries. */
export function mmss(sec: number): string {
  sec = Math.max(0, Math.round(sec)); // 59.6 → "1:00", not "0:60"
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
