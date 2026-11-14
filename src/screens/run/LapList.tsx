import { useT } from '../../i18n';
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
  kind = 'round',
  newestFirst = false,
  limit,
  tenths = true,
}: {
  rows: SplitRow[];
  label: string;
  /** Row naming: "Lap 3" or "Rd 3". */
  kind?: 'lap' | 'round';
  newestFirst?: boolean;
  limit?: number;
  tenths?: boolean;
}) {
  const { t } = useT();
  if (rows.length === 0) return null;
  let fastest = -1;
  let slowest = -1;
  if (rows.length >= 3) {
    let min = Infinity;
    let max = -Infinity;
    // Compare at displayed (tenths) precision so equal-looking splits aren't tagged.
    rows.forEach((r) => {
      const v = Math.floor(r.splitMs / 100);
      if (v < min) {
        min = v;
        fastest = r.index;
      }
      if (v > max) {
        max = v;
        slowest = r.index;
      }
    });
    if (min === max) fastest = slowest = -1;
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
              {t(kind === 'lap' ? 'split.lap' : 'split.rd', { n: r.index })}
            </span>
            {tag ? <span className="splits__tag">{tag === 'fast' ? t('split.fastest') : t('split.slowest')}</span> : <span />}
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
