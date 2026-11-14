import { useT } from '../i18n';
import { niceMax, type WeekBucket } from './records';

const W = 320;
const H = 132;
const TOP = 18;
const BOTTOM = 22;
const PLOT = H - TOP - BOTTOM;
const LEFT = 26;

/**
 * Minutes-per-week bar chart, pure SVG. The SVG is decorative for assistive
 * tech; the same numbers are exposed as a visually hidden table.
 */
export function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const { t, locale } = useT();
  const peak = Math.max(0, ...weeks.map((w) => w.minutes));
  const max = niceMax(peak);
  const slot = (W - LEFT) / weeks.length;
  const barW = Math.min(26, slot * 0.56);
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const last = weeks.length - 1;
  const total = weeks.reduce((a, w) => a + w.minutes, 0);
  const avg = Math.round(total / Math.max(1, weeks.length));

  return (
    <figure className="hist-chart">
      <figcaption className="hist-chart__head">
        <span className="hist-chart__title">{t('hist.chartTitle')}</span>
        <span className="hist-chart__sum num">
          {t('hist.chartAvg', { n: avg })}
        </span>
      </figcaption>
      <svg className="hist-chart__svg" viewBox={`0 0 ${W} ${H}`} aria-hidden focusable="false">
        <line className="hist-chart__grid" x1={LEFT} x2={W} y1={TOP} y2={TOP} />
        <line className="hist-chart__grid" x1={LEFT} x2={W} y1={TOP + PLOT / 2} y2={TOP + PLOT / 2} />
        <line className="hist-chart__base" x1={LEFT} x2={W} y1={TOP + PLOT} y2={TOP + PLOT} />
        <text className="hist-chart__axis" x={LEFT - 6} y={TOP + 3.5} textAnchor="end">
          {max}
        </text>
        <text className="hist-chart__axis" x={LEFT - 6} y={TOP + PLOT / 2 + 3.5} textAnchor="end">
          {max / 2}
        </text>
        <text className="hist-chart__axis" x={LEFT - 6} y={TOP + PLOT + 3.5} textAnchor="end">
          0
        </text>
        {weeks.map((w, i) => {
          const h = w.minutes > 0 ? Math.max(4, (w.minutes / max) * PLOT) : 0;
          const x = LEFT + i * slot + (slot - barW) / 2;
          const y = TOP + PLOT - h;
          const current = i === last;
          return (
            <g key={w.start} className={`hist-chart__bar${current ? ' is-current' : ''}`}>
              <title>{`${t('hist.chartWeekOf', { date: fmt(w.start) })}: ${t('hist.min', { n: w.minutes })}`}</title>
              {h > 0 ? (
                <rect x={x} y={y} width={barW} height={h} rx={Math.min(6, barW / 2)} />
              ) : (
                <rect className="hist-chart__empty" x={x} y={TOP + PLOT - 3} width={barW} height={3} rx={1.5} />
              )}
              {(current || w.minutes === peak) && w.minutes > 0 && (
                <text className="hist-chart__value" x={x + barW / 2} y={y - 5} textAnchor="middle">
                  {w.minutes}
                </text>
              )}
              {(last - i) % 2 === 0 && (
                <text className="hist-chart__label" x={x + barW / 2} y={H - 6} textAnchor="middle">
                  {fmt(w.start)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <caption>{t('hist.chartAria')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('hist.week')}</th>
            <th scope="col">{t('hist.chartMinutes')}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">{fmt(w.start)}</th>
              <td>{w.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
