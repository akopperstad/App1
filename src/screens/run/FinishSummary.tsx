import { useState } from 'react';
import { describe, modeInfo } from '../../engine/modes';
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

export function FinishSummary({ config, snap, segments, completed, natural, onRepeat, onHome }: Props) {
  const [naming, setNaming] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState(config.name ?? '');

  const info = modeInfo(config.mode);
  const total = formatClock(snap.workElapsedMs, { tenths: true });
  const rounds = roundsFor(config, snap, segments, natural);
  const showRounds = config.mode === 'amrap' || config.mode === 'fortime' || config.mode === 'deathby' || rounds > 0;
  const splits = roundRows(snap.roundTapTimesMs);
  const avg = splits.length ? splits.reduce((a, r) => a + r.splitMs, 0) / splits.length : 0;
  const laps = snap.laps.map((l) => ({ index: l.index, atMs: l.atMs, splitMs: l.splitMs }));
  // For Time that ran into its cap is "capped", not "complete" — that's how athletes log it.
  const capped =
    natural && config.mode === 'fortime' && config.capSec > 0 && snap.workElapsedMs >= config.capSec * 1000 - 50;
  const eyebrow = capped ? 'Time cap reached' : completed ? 'Workout complete' : 'Workout ended';
  // Segment progress only means something when the plan has several (non get-ready) segments.
  const workSegs = segments.filter((s) => s.kind !== 'prep').length;
  const prepSegs = segments.length - workSegs;
  const segsDone = completed ? workSegs : Math.max(0, Math.min(snap.segmentIndex - prepSegs, workSegs));
  const roundsLabel = config.mode === 'deathby' ? 'Rounds survived' : 'Rounds';
  const roundsValue =
    config.mode === 'fortime' && config.targetRounds > 0 ? `${rounds} / ${config.targetRounds}` : String(rounds);

  return (
    <section className="summary" aria-labelledby="summary-title">
      <div className="summary__left">
        <div className="summary__hero">
          <div className={`summary__badge${completed ? '' : ' is-partial'}`} aria-hidden="true">
            {completed ? <IconCheck size={30} /> : <IconStop size={24} />}
          </div>
          <p className="summary__eyebrow">{eyebrow}</p>
          <h1 id="summary-title" className="summary__title">
            {config.name?.trim() || info.title}
          </h1>
          <p className="summary__sub">
            {info.title} · {describe(config)}
          </p>
          <div className="summary__time num" aria-label={`Total time ${formatClockString(snap.workElapsedMs)}`}>
            {total.main}
            <span className="summary__tenths">.{total.tenths}</span>
          </div>
          <p className="summary__time-label">Total time</p>
        </div>
        <div className="summary__actions">
          <button type="button" className="btn btn--primary" onClick={onRepeat}>
            <IconRepeat size={22} /> Repeat
          </button>
          <button type="button" className="btn" onClick={() => setNaming(true)} disabled={saved !== null}>
            <IconBookmark size={20} /> {saved ? 'Saved' : 'Save preset'}
          </button>
          <button type="button" className="btn" onClick={onHome}>
            <IconHome size={20} /> Home
          </button>
        </div>
        {saved && (
          <p className="summary__toast" role="status">
            Saved “{saved}” to your presets
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
              <span className="stat-card__label">Avg round</span>
              <span className="stat-card__value num">{formatClockString(avg)}</span>
            </div>
          )}
          {laps.length > 0 && (
            <div className="stat-card">
              <span className="stat-card__label">Laps</span>
              <span className="stat-card__value num">{laps.length}</span>
            </div>
          )}
          {!showRounds && laps.length === 0 && workSegs > 1 && (
            <div className="stat-card">
              <span className="stat-card__label">Segments</span>
              <span className="stat-card__value num">
                {segsDone} / {workSegs}
              </span>
            </div>
          )}
        </div>

        {splits.length > 0 && (
          <div className="summary__list">
            <h2 className="summary__h">Round splits</h2>
            <SplitList rows={splits} label="Round splits" />
          </div>
        )}
        {laps.length > 0 && (
          <div className="summary__list">
            <h2 className="summary__h">Laps</h2>
            <SplitList rows={laps} label="Laps" />
          </div>
        )}
      </div>

      {naming && (
        <Sheet title="Save as preset" onClose={() => setNaming(false)}>
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
              <span className="field__label">Preset name</span>
              <input
                className="ui-input field__input"
                data-autofocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`My ${info.title}`}
                maxLength={40}
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
            <div className="sheet__actions">
              <button type="button" className="btn" onClick={() => setNaming(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
                Save
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </section>
  );
}
