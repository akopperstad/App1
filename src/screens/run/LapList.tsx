import { formatClockString } from '../../lib/format';

export interface SplitRow {
  index: number;
  splitMs: number;
  atMs: number;
}

/** Split list with fastest / slowest highlighted (when there are at least 3 rows). */
export function SplitList({
  rows,
  label,
  newestFirst = false,
  limit,
  tenths = true,
}: {
  rows: SplitRow[];
  label: string;
  newestFirst?: boolean;
  limit?: number;
  tenths?: boolean;
}) {
  if (rows.length === 0) return null;
  let fastest = -1;
  let slowest = -1;
  if (rows.length >= 3) {
    let min = Infinity;
    let max = -Infinity;
    rows.forEach((r) => {
      if (r.splitMs < min) {
        min = r.splitMs;
        fastest = r.index;
      }
      if (r.splitMs > max) {
        max = r.splitMs;
        slowest = r.index;
      }
    });
  }
  let list = newestFirst ? [...rows].reverse() : rows;
  if (limit) list = list.slice(0, limit);
  return (
    <ol className="splits" aria-label={label}>
      {list.map((r) => {
        const tag = r.index === fastest ? 'fast' : r.index === slowest ? 'slow' : '';
        return (
          <li key={r.index} className={`splits__row${tag ? ` is-${tag}` : ''}`}>
            <span className="splits__idx num">
              {label.startsWith('Lap') ? 'Lap' : 'Rd'} {r.index}
            </span>
            {tag ? <span className="splits__tag">{tag === 'fast' ? 'Fastest' : 'Slowest'}</span> : <span />}
            <span className="splits__split num">{formatClockString(r.splitMs, { tenths })}</span>
            <span className="splits__at num">{formatClockString(r.atMs)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function roundRows(times: number[]): SplitRow[] {
  return times.map((t, i) => ({ index: i + 1, atMs: t, splitMs: t - (times[i - 1] ?? 0) }));
}
