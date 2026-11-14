import { useState, type CSSProperties } from 'react';
import { describe, modeTitle } from '../../engine/modes';
import { useT } from '../../i18n';
import type { Segment, Snapshot, WorkoutConfig } from '../../engine/types';
import { formatClock, formatClockString } from '../../lib/format';
import { savePreset } from '../../state/store';
import { IconBookmark, IconCheck, IconHome, IconRepeat, IconStop } from './icons';
import { roundRows, SplitList } from './LapList';
import { roundsFor } from './session';
import { Sheet } from './Sheet';

interface Props {
  config: WorkoutConfig;
  snap: Snapshot;
  segments: readonly Segment[];
  completed: boolean;
  natural: boolean;
  onRepeat: () => void;
  onHome: () => void;
}

const CONFETTI_COLORS = ['var(--work)', 'var(--rest)', 'var(--prep)', 'var(--done)', 'var(--mode-fortime)', 'var(--mode-tabata)'];

/** A short, CSS-only burst behind the badge (hidden with reduced motion). */
function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => {
        const angle = (i * 360) / 30 + ((i * 37) % 11) - 5;
        const style = {
          '--a': `${angle}deg`,
          '--r': `${90 + ((i * 53) % 90)}px`,
          '--s': `${(i % 2 ? 1 : -1) * (240 + ((i * 71) % 300))}deg`,
          '--d': `${(i * 23) % 140}ms`,
          '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        } as CSSProperties;
        return <span key={i} className="confetti__p" style={style} />;
      })}
    </div>
  );
}

export function FinishSummary({ config, snap, segments, completed, natural, onRepeat, onHome }: Props) {
  const [naming, setNaming] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState(config.name ?? '');

  const tr = useT();
  const { t } = tr;
  const modeName = modeTitle(config.mode, tr);
  const total = formatClock(snap.workElapsedMs, { tenths: true });
  const rounds = roundsFor(config, snap, segments, natural);
  const showRounds = config.mode === 'amrap' || config.mode === 'fortime' || config.mode === 'deathby' || rounds > 0;
  const splits = roundRows(snap.roundTapTimesMs);
  const avg = splits.length ? splits.reduce((a, r) => a + r.splitMs, 0) / splits.length : 0;
  const laps = snap.laps.map((l) => ({ index: l.index, atMs: l.atMs, splitMs: l.splitMs }));
  // For Time that ran into its cap is "capped", not "complete" — that's how athletes log it.
  const capped =
    natural && config.mode === 'fortime' && config.capSec > 0 && snap.workElapsedMs >= config.capSec * 1000 - 50;
  const eyebrow = capped ? t('fin.capped') : completed ? t('fin.complete') : t('fin.ended');
  // Segment progress only means something when the plan has several (non get-ready) segments.
  const workSegs = segments.filter((s) => s.kind !== 'prep').length;
  const prepSegs = segments.length - workSegs;
  const segsDone = completed ? workSegs : Math.max(0, Math.min(snap.segmentIndex - prepSegs, workSegs));
  const roundsLabel = config.mode === 'deathby' ? t('fin.roundsSurvived') : t('fin.rounds');
  const roundsValue =
    config.mode === 'fortime' && config.targetRounds > 0 ? `${rounds} / ${config.targetRounds}` : String(rounds);

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__left">
        <div className="summary__hero">
          {/* Capped For Time still counts as done (saved as completed): the full cap was worked. */}
          {completed && <Confetti />}
          <div className={`summary__badge${completed ? '' : ' is-partial'}`} aria-hidden="true">
            {completed ? <IconCheck size={30} /> : <IconStop size={24} />}
          </div>
          <p className="summary__eyebrow">{eyebrow}</p>
          <h1 id="summary-title" className="summary__title">
            {config.name?.trim() || modeName}
          </h1>
          <p className="summary__sub">
            {modeName} · {describe(config, tr)}
          </p>
          <div className="summary__time num" aria-label={t('fin.totalAria', { time: formatClockString(snap.workElapsedMs) })}>
            {total.main}
            <span className="summary__tenths">.{total.tenths}</span>
          </div>
          <p className="summary__time-label">{t('fin.totalTime')}</p>
        </div>
        <div className="summary__actions">
          <button type="button" className="btn btn--primary" onClick={onRepeat}>
            <IconRepeat size={22} /> {t('fin.repeat')}
          </button>
          <button type="button" className="btn" onClick={() => setNaming(true)} disabled={saved !== null}>
            <IconBookmark size={20} /> {saved ? t('fin.saved') : t('fin.save')}
          </button>
          <button type="button" className="btn" onClick={onHome}>
            <IconHome size={20} /> {t('fin.home')}
          </button>
        </div>
        {saved && (
          <p className="summary__toast" role="status">
            {t('fin.savedToast', { name: saved })}
          </p>
        )}
      </div>

      <div className="summary__right">
        <div className="summary__stats">
          {showRounds && (
            <div className="stat-card">
              <span className="stat-card__label">{roundsLabel}</span>
              <span className="stat-card__value num">{roundsValue}</span>
            </div>
          )}
          {splits.length > 0 && (
            <div className="stat-card">
              <span className="stat-card__label">{t('fin.avgRound')}</span>
              <span className="stat-card__value num">{formatClockString(avg)}</span>
            </div>
          )}
          {laps.length > 0 && (
            <div className="stat-card">
              <span className="stat-card__label">{t('fin.laps')}</span>
              <span className="stat-card__value num">{laps.length}</span>
            </div>
          )}
          {!showRounds && laps.length === 0 && workSegs > 1 && (
            <div className="stat-card">
              <span className="stat-card__label">{t('fin.segments')}</span>
              <span className="stat-card__value num">
                {segsDone} / {workSegs}
              </span>
            </div>
          )}
        </div>

        {splits.length > 0 && (
          <div className="summary__list">
            <h2 className="summary__h">{t('fin.roundSplits')}</h2>
            <SplitList rows={splits} label={t('fin.roundSplits')} />
          </div>
        )}
        {laps.length > 0 && (
          <div className="summary__list">
            <h2 className="summary__h">{t('fin.laps')}</h2>
            <SplitList rows={laps} label={t('fin.laps')} kind="lap" />
          </div>
        )}
      </div>

      <Sheet open={naming} title={t('fin.saveAs')} onClose={() => setNaming(false)}>
        <form
          className="sheet__form"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            savePreset(n, config);
            setSaved(n);
            setNaming(false);
          }}
        >
          <label className="field">
            <span className="field__label">{t('fin.name')}</span>
            <input
              className="ui-input field__input"
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('cfg.namePlaceholder', { mode: modeName })}
              maxLength={40}
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>
          <div className="sheet__actions">
            <button type="button" className="btn" onClick={() => setNaming(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              {t('common.save')}
            </button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
