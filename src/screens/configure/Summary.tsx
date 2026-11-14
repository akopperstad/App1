import { useMemo } from 'react';
import { compile } from '../../engine/compile';
import { totalSeconds } from '../../engine/modes';
import type { WorkoutConfig } from '../../engine/types';
import { useT } from '../../i18n';
import { formatClockString, formatDuration } from '../../lib/format';

const MAX_BLOCKS = 160;

/** Live summary: total time, interval count and a proportional timeline bar. */
export function Summary({ config }: { config: WorkoutConfig }) {
  const tr = useT();
  const { t, tp } = tr;
  const segments = useMemo(() => compile(config, 0, tr).filter((s) => s.kind !== 'prep'), [config, tr]);
  const total = totalSeconds(config);

  const timed = segments.filter((s) => s.durationMs !== null);
  const avg = timed.length ? timed.reduce((a, s) => a + (s.durationMs ?? 0), 0) / timed.length : 60_000;
  const work = segments.filter((s) => s.kind === 'work');
  const workMs = work.reduce((a, s) => a + (s.durationMs ?? 0), 0);
  const restMs = segments.filter((s) => s.kind === 'rest').reduce((a, s) => a + (s.durationMs ?? 0), 0);

  let big: string;
  let caption: string;
  if (config.mode === 'deathby') {
    big = formatClockString(config.intervalSec * config.maxRounds * 1000);
    caption = t('sum.maxTime');
  } else if (total !== null) {
    big = formatClockString(total * 1000);
    caption = t('sum.totalTime');
  } else {
    big = t('sum.open');
    caption = config.mode === 'stopwatch' ? t('sum.countsUp') : t('sum.openEnded');
  }

  let countLabel: string;
  let count: number;
  if (config.mode === 'deathby') {
    count = config.maxRounds;
    countLabel = t('sum.maxRounds');
  } else if (config.mode === 'fortime') {
    count = config.targetRounds;
    countLabel = t('sum.targetRounds');
  } else {
    count = segments.length;
    countLabel = tp('sum.intervals', count);
  }
  const showCount = count > 1 || (config.mode === 'fortime' && count > 0);

  const blocks = segments.slice(0, MAX_BLOCKS);
  const showBar = segments.length > 1;

  return (
    <section className="cfg-summary" aria-label={t('sum.aria')}>
      <div className="cfg-summary__top">
        <div>
          <div className="cfg-summary__big num">{big}</div>
          <div className="cfg-summary__cap">{caption}</div>
        </div>
        {showCount && (
          <div className="cfg-summary__count">
            <div className="cfg-summary__countnum num">{count}</div>
            <div className="cfg-summary__cap">{countLabel}</div>
          </div>
        )}
      </div>
      {showBar && (
        <div className="cfg-timeline" role="img" aria-label={t('sum.timeline', { n: segments.length })}>
          {blocks.map((s, i) => (
            <span
              key={i}
              className={`cfg-timeline__b is-${s.kind}${s.durationMs === null ? ' is-open' : ''}`}
              style={{ flexGrow: s.durationMs ?? avg }}
            />
          ))}
        </div>
      )}
      {showBar && (
        <div className="cfg-legend">
          <span className="is-work">
            {t('seg.work')}
            {workMs > 0 && <b className="num">{formatDuration(Math.round(workMs / 1000), tr)}</b>}
          </span>
          {restMs > 0 && (
            <span className="is-rest">
              {t('seg.rest')}
              <b className="num">{formatDuration(Math.round(restMs / 1000), tr)}</b>
            </span>
          )}
          {segments.some((s) => s.durationMs === null) && <span className="is-open">{t('sum.untimed')}</span>}
        </div>
      )}
    </section>
  );
}
