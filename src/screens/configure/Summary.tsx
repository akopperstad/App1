import { useMemo } from 'react';
import { compile } from '../../engine/compile';
import { totalSeconds } from '../../engine/modes';
import type { WorkoutConfig } from '../../engine/types';
import { formatClockString, formatDuration } from '../../lib/format';

const MAX_BLOCKS = 160;

/** Live summary: total time, interval count and a proportional timeline bar. */
export function Summary({ config }: { config: WorkoutConfig }) {
  const segments = useMemo(() => compile(config, 0).filter((s) => s.kind !== 'prep'), [config]);
  const total = totalSeconds(config);

  const timed = segments.filter((s) => s.durationMs !== null);
  const avg = timed.length ? timed.reduce((a, s) => a + (s.durationMs ?? 0), 0) / timed.length : 60_000;
  const work = segments.filter((s) => s.kind === 'work');
  const workMs = work.reduce((a, s) => a + (s.durationMs ?? 0), 0);
  const restMs = segments.filter((s) => s.kind === 'rest').reduce((a, s) => a + (s.durationMs ?? 0), 0);

  let big: string;
  let caption: string;
  if (total !== null) {
    big = formatClockString(total * 1000);
    caption = 'Total time';
  } else if (config.mode === 'deathby') {
    big = formatClockString(config.intervalSec * config.maxRounds * 1000);
    caption = 'Max time · until failure';
  } else {
    big = 'Open';
    caption = config.mode === 'stopwatch' ? 'Counts up · no limit' : 'Open-ended · you finish it';
  }

  let countLabel: string;
  let count: number;
  if (config.mode === 'deathby') {
    count = config.maxRounds;
    countLabel = 'max rounds';
  } else {
    count = segments.length;
    countLabel = count === 1 ? 'interval' : 'intervals';
  }

  const blocks = segments.slice(0, MAX_BLOCKS);
  const showBar = segments.length > 1 || segments[0]?.durationMs !== null;

  return (
    <section className="cfg-summary" aria-label="Workout summary">
      <div className="cfg-summary__top">
        <div>
          <div className="cfg-summary__big num">{big}</div>
          <div className="cfg-summary__cap">{caption}</div>
        </div>
        <dl className="cfg-summary__stats">
          <div>
            <dt>{countLabel}</dt>
            <dd className="num">{count}</dd>
          </div>
          {workMs > 0 && restMs > 0 && (
            <div>
              <dt>work / rest</dt>
              <dd className="num">
                {formatDuration(Math.round(workMs / 1000))}
                <span> / {formatDuration(Math.round(restMs / 1000))}</span>
              </dd>
            </div>
          )}
        </dl>
      </div>
      {showBar && (
        <div className="cfg-timeline" role="img" aria-label={`Timeline of ${segments.length} intervals`}>
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
        <div className="cfg-legend" aria-hidden>
          <span className="is-work">Work</span>
          {restMs > 0 && <span className="is-rest">Rest</span>}
          {segments.some((s) => s.durationMs === null) && <span className="is-open">Untimed</span>}
        </div>
      )}
    </section>
  );
}
