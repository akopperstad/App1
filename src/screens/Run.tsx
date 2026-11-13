import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cuePlayer } from '../audio/cues';
import { compile } from '../engine/compile';
import { TimerEngine } from '../engine/engine';
import { describe, modeInfo, totalSeconds } from '../engine/modes';
import type { Cue, SegmentKind, Snapshot, WorkoutConfig } from '../engine/types';
import { formatClock, formatDuration } from '../lib/format';
import { useWakeLock } from '../lib/wakeLock';
import { useNav } from '../nav';
import { addHistory, settingsStore, useSettings } from '../state/store';
import {
  announceFor,
  clockModel,
  displayKey,
  firstWork,
  phaseLabel,
  phaseOf,
  ringValue,
  roundInfo,
  segmentShort,
  segmentTime,
} from './run/display';
import { FinishSummary } from './run/FinishSummary';
import { HoldButton } from './run/HoldButton';
import {
  IconBack,
  IconCheck,
  IconExpand,
  IconFlag,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconReset,
  IconShrink,
  IconStop,
} from './run/icons';
import { SplitList } from './run/LapList';
import { MiniRing, OverallBar, ProgressRing, SegmentBar } from './run/Progress';
import { RoundCounter } from './run/RoundCounter';
import { buildEntry } from './run/session';
import { Sheet } from './run/Sheet';
import { createFrameBus, useTimer } from './run/useTimer';
import './Run.css';

type SheetKind = 'reset' | 'leave' | 'end' | null;
type FinishReason = 'done' | 'end' | null;

export function Run({ config }: { config: WorkoutConfig }) {
  const nav = useNav();
  const settings = useSettings();
  const info = modeInfo(config.mode);

  // ------------------------------------------------------------ engine
  const cueRef = useRef<(cue: Cue) => void>(() => {});
  const [engine] = useState(
    () => new TimerEngine(compile(config, settingsStore.get().prepSec), { onCue: (c) => cueRef.current(c) }),
  );
  const [bus] = useState(createFrameBus);
  const segments = engine.getSegments();
  const idleSeg = useMemo(() => firstWork(segments), [segments]);
  const workSegCount = useMemo(() => segments.filter((s) => s.kind !== 'prep').length, [segments]);
  const multiSeg = workSegCount > 1;

  const keyOf = useCallback(
    (s: Snapshot) => displayKey(s, config, settingsStore.get(), idleSeg),
    [config, idleSeg],
  );
  const snap = useTimer(engine, keyOf, bus);
  const { status } = snap;
  const active = status === 'running' || status === 'paused';

  // ------------------------------------------------------------ flash / announcements
  const [flash, setFlash] = useState<{ n: number; kind: SegmentKind } | null>(null);
  const [announce, setAnnounce] = useState('');

  cueRef.current = (cue: Cue) => {
    const st = settingsStore.get();
    try {
      cuePlayer.handle(cue, st);
    } catch (err) {
      console.error(err);
    }
    switch (cue.type) {
      case 'segment':
        if (st.flashOnChange) setFlash((f) => ({ n: (f?.n ?? 0) + 1, kind: cue.segment.kind }));
        setAnnounce(announceFor(cue.segment, config));
        break;
      case 'start':
        setAnnounce(announceFor(cue.segment, config));
        break;
      case 'finish':
        setAnnounce('Workout complete');
        break;
      case 'pause':
        setAnnounce('Paused');
        break;
      case 'resume':
        setAnnounce('Resumed');
        break;
    }
  };

  // ------------------------------------------------------------ session / history
  const session = useRef<{ startedAt: number | null; saved: boolean; reason: FinishReason }>({
    startedAt: null,
    saved: false,
    reason: null,
  });
  const [finishReason, setFinishReason] = useState<FinishReason>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const persist = useCallback(
    (completed: boolean, natural: boolean) => {
      const ses = session.current;
      if (ses.saved || ses.startedAt === null) return;
      const s = engine.snapshot();
      if (!completed && s.workElapsedMs < 5000) return;
      ses.saved = true;
      addHistory(buildEntry(config, s, engine.getSegments(), ses.startedAt, completed, natural));
    },
    [engine, config],
  );

  useEffect(() => {
    if (status !== 'finished') return;
    const reason = session.current.reason;
    persist(reason !== 'end', reason === null);
  }, [status, persist]);

  // Leaving by hardware back / unmount: keep what was done.
  useEffect(() => {
    const onHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      const st = engine.getStatus();
      if (st === 'running' || st === 'paused') persist(false, false);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      const st = engine.getStatus();
      if (st === 'running' || st === 'paused') {
        persist(false, false);
        engine.pause();
      }
    };
  }, [engine, persist]);

  useEffect(() => {
    if (!active) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [active]);

  useWakeLock(settings.keepAwake && active);

  // ------------------------------------------------------------ actions
  const begin = useCallback(() => {
    cuePlayer.unlock(); // must stay synchronous inside the user gesture (iOS)
    const st = engine.getStatus();
    if (st === 'finished') {
      engine.reset();
    }
    if (st === 'idle' || st === 'finished') {
      session.current = { startedAt: Date.now(), saved: false, reason: null };
      setFinishReason(null);
    }
    engine.start();
  }, [engine]);

  const toggle = useCallback(() => {
    if (engine.getStatus() === 'running') engine.pause();
    else begin();
  }, [engine, begin]);

  const doReset = useCallback(() => {
    persist(false, false);
    engine.reset();
    session.current = { startedAt: null, saved: false, reason: null };
    setFinishReason(null);
    setSheet(null);
  }, [engine, persist]);

  const finishWith = useCallback(
    (reason: Exclude<FinishReason, null>) => {
      session.current.reason = reason;
      setFinishReason(reason);
      engine.finish();
      setSheet(null);
    },
    [engine],
  );

  const goHome = useCallback(() => {
    const depth = typeof history.state?.depth === 'number' ? history.state.depth : 0;
    if (depth > 0) history.go(-depth);
    else nav.replace({ name: 'home' });
  }, [nav]);

  const leave = useCallback(() => {
    persist(false, false);
    engine.pause();
    nav.back();
  }, [engine, nav, persist]);

  const requestBack = useCallback(() => {
    const st = engine.getStatus();
    if (st === 'running' || st === 'paused') setSheet('leave');
    else nav.back();
  }, [engine, nav]);

  // ------------------------------------------------------------ fullscreen
  const fsSupported =
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function' &&
    document.fullscreenEnabled !== false;
  const [isFs, setIsFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
  const toggleFs = useCallback(() => {
    if (!fsSupported) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }, [fsSupported]);

  // ------------------------------------------------------------ capabilities
  const mode = config.mode;
  const seg = snap.segment;
  const inPrep = active && seg.kind === 'prep';
  const hasRounds = mode === 'amrap' || mode === 'fortime' || mode === 'deathby';
  const hasLaps = mode === 'stopwatch' || mode === 'fortime';
  const doneIsPrimary = mode === 'fortime' || mode === 'stopwatch' || mode === 'deathby';
  const untimedStep = active && seg.durationMs === null && mode === 'custom';
  const isLastSeg = snap.segmentIndex >= snap.segmentCount - 1;
  const canAdjust = mode === 'countdown' && active && seg.kind === 'work';

  // ------------------------------------------------------------ keyboard
  const keys = useRef<{
    toggle: () => void;
    next: () => void;
    prev: () => void;
    lap: () => void;
    round: () => void;
    back: () => void;
    fs: () => void;
    sheetOpen: boolean;
  } | null>(null);
  keys.current = {
    toggle,
    next: () => engine.next(),
    prev: () => engine.previous(),
    lap: () => {
      if (hasLaps && seg.kind !== 'prep') engine.lap();
    },
    round: () => {
      if (hasRounds && seg.kind !== 'prep') engine.tapRound();
    },
    back: requestBack,
    fs: toggleFs,
    sheetOpen: sheet !== null,
  };
  useEffect(() => {
    const ignore = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return true;
      const t = e.target as HTMLElement | null;
      return !!t?.closest?.('input, textarea, select, [contenteditable="true"]');
    };
    const onDown = (e: KeyboardEvent) => {
      const k = keys.current;
      if (!k || e.defaultPrevented || ignore(e) || k.sheetOpen) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let handled = true;
      switch (key) {
        case ' ':
          if (!e.repeat) k.toggle();
          break;
        case 'ArrowRight':
          k.next();
          break;
        case 'ArrowLeft':
          k.prev();
          break;
        case 'l':
          if (!e.repeat) k.lap();
          break;
        case 'r':
          if (!e.repeat) k.round();
          break;
        case 'f':
          k.fs();
          break;
        case 'Escape':
          k.back();
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    // Stop a focused button from also "clicking" on Space keyup.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !ignore(e) && !keys.current?.sheetOpen) e.preventDefault();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ------------------------------------------------------------ display model
  const phase = phaseOf(snap);
  const clock = clockModel(snap, config, settings, idleSeg);
  const ring = useCallback(
    (s: Snapshot) => ringValue(s, config, settingsStore.get(), idleSeg),
    [config, idleSeg],
  );

  const label = status === 'idle' ? info.title : phaseLabel(seg);
  const detail =
    status === 'idle' ? config.name?.trim() || info.tagline : seg.detail && !/^Next:/.test(seg.detail) ? seg.detail : undefined;
  const subInfo =
    status === 'idle'
      ? describe(config)
      : seg.kind === 'prep'
        ? `${info.title} · ${describe(config)}`
        : roundInfo(seg, config) || (seg.detail && /^Next:/.test(seg.detail) ? seg.detail.replace(/^Next:\s*/, 'Up next: ') : '');

  const planned = snap.plannedWorkMs;
  const stats: { label: string; value: string; wide?: boolean }[] = [];
  if (status !== 'idle') {
    if (multiSeg || planned === null || clock.down) {
      stats.push({ label: 'Elapsed', value: formatClock(snap.workElapsedMs).main });
    }
    if (planned !== null && mode !== 'deathby') {
      stats.push({
        label: mode === 'fortime' ? 'To cap' : 'Remaining',
        value: formatClock(Math.max(0, planned - snap.workElapsedMs), { roundUp: true }).main,
      });
    }
    if (snap.next && multiSeg) {
      stats.push({ label: 'Next up', value: `${segmentShort(snap.next)} · ${segmentTime(snap.next)}`, wide: true });
    } else if (multiSeg && !snap.next) {
      stats.push({ label: 'Next up', value: 'Finish', wide: true });
    }
  }

  const total = totalSeconds(config);
  const overview: string[] = [];
  if (total !== null) overview.push(`Total ${formatDuration(total)}`);
  else overview.push('Open-ended');
  if (workSegCount > 1) overview.push(`${workSegCount} segments`);
  if (segments[0].kind === 'prep') overview.push(`${formatDuration((segments[0].durationMs ?? 0) / 1000)} get ready`);

  const style = { '--accent': info.accent, '--em': clock.em } as CSSProperties;
  const finished = status === 'finished';

  // ------------------------------------------------------------ pieces
  const playBtn = (
    <button
      type="button"
      className={`transport__play${status === 'paused' ? ' is-paused' : ''}`}
      onClick={toggle}
      aria-label={status === 'running' ? 'Pause' : 'Resume'}
    >
      {status === 'running' ? <IconPause size={44} /> : <IconPlay size={44} />}
    </button>
  );

  const resetBtn = (cls: string, withLabel: boolean) => (
    <HoldButton
      className={cls}
      label="Reset"
      requireHold={active}
      disabled={status === 'idle'}
      onConfirm={doReset}
      onRequestConfirm={() => setSheet('reset')}
    >
      <IconReset size={withLabel ? 20 : 26} />
      {withLabel && <span>Hold to reset</span>}
    </HoldButton>
  );

  const endBtn = (
    <HoldButton
      className="pill"
      label="End workout"
      requireHold={active}
      disabled={!active}
      onConfirm={() => finishWith('end')}
      onRequestConfirm={() => setSheet('end')}
    >
      <IconStop size={18} />
      <span>Hold to end</span>
    </HoldButton>
  );

  const doneTile = (
    <button type="button" className="tile tile--done" onClick={() => finishWith('done')} disabled={!active || inPrep}>
      <IconCheck size={28} />
      <span>Done</span>
    </button>
  );

  let actions: ReactNode = null;
  if (active) {
    if (untimedStep) {
      actions = (
        <button type="button" className="tile tile--next" onClick={() => engine.next()}>
          <span>{isLastSeg ? 'Finish' : 'Step done'}</span>
          <IconNext size={26} />
        </button>
      );
    } else if (mode === 'amrap' || mode === 'fortime' || mode === 'deathby') {
      actions = (
        <>
          <RoundCounter
            count={snap.roundsTapped}
            times={snap.roundTapTimesMs}
            target={mode === 'fortime' && config.targetRounds > 0 ? config.targetRounds : undefined}
            disabled={inPrep}
            onTap={() => engine.tapRound()}
            onUndo={() => engine.undoRound()}
          />
          {doneIsPrimary && doneTile}
        </>
      );
    } else if (mode === 'stopwatch') {
      actions = (
        <>
          <button type="button" className="tile tile--lap" onClick={() => engine.lap()} disabled={inPrep}>
            <IconFlag size={26} />
            <span>Lap</span>
            {snap.laps.length > 0 && <span className="tile__badge num">{snap.laps.length}</span>}
          </button>
          {doneTile}
        </>
      );
    } else if (canAdjust) {
      actions = (
        <div className="adjust" role="group" aria-label="Adjust time">
          <button type="button" className="tile tile--adj num" onClick={() => engine.adjustCurrent(-10_000)}>
            −0:10
          </button>
          <button type="button" className="tile tile--adj num" onClick={() => engine.adjustCurrent(10_000)}>
            +0:10
          </button>
          <button type="button" className="tile tile--adj num" onClick={() => engine.adjustCurrent(60_000)}>
            +1:00
          </button>
        </div>
      );
    }
  }

  let left: ReactNode;
  let right: ReactNode;
  if (multiSeg) {
    left = (
      <button type="button" className="transport__side" onClick={() => engine.previous()} aria-label="Previous segment">
        <IconPrev size={28} />
      </button>
    );
    right = (
      <button type="button" className="transport__side" onClick={() => engine.next()} aria-label="Next segment">
        <IconNext size={28} />
      </button>
    );
  } else {
    left = resetBtn('transport__side hold', false);
    if (inPrep) {
      right = (
        <button type="button" className="transport__side" onClick={() => engine.next()} aria-label="Skip get ready">
          <IconNext size={28} />
        </button>
      );
    } else if (mode === 'fortime') {
      right = (
        <button type="button" className="transport__side" onClick={() => engine.lap()} aria-label="Lap">
          <IconFlag size={26} />
        </button>
      );
    } else if (mode === 'countdown') {
      right = (
        <HoldButton
          className="transport__side hold"
          label="End"
          requireHold
          onConfirm={() => finishWith('end')}
          onRequestConfirm={() => setSheet('end')}
        >
          <IconStop size={24} />
        </HoldButton>
      );
    } else {
      right = <span className="transport__side transport__spacer" aria-hidden="true" />;
    }
  }

  return (
    <div className="run" data-phase={phase} data-status={status} style={style}>
      <div className="run__bg" aria-hidden="true" />
      {flash && settings.flashOnChange && (
        <div key={flash.n} className={`run__flash run__flash--${flash.kind}`} aria-hidden="true" />
      )}

      <header className="run__top">
        <button type="button" className="icon-btn" onClick={requestBack} aria-label="Back">
          <IconBack size={26} />
        </button>
        <div className="run__title">
          <span className="run__name">{config.name?.trim() || info.title}</span>
          {status !== 'idle' && !finished && <span className="run__mode">{describe(config)}</span>}
        </div>
        {fsSupported ? (
          <button
            type="button"
            className="icon-btn"
            onClick={toggleFs}
            aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen'}
            aria-pressed={isFs}
          >
            {isFs ? <IconShrink size={22} /> : <IconExpand size={22} />}
          </button>
        ) : (
          <span className="icon-btn icon-btn--ghost" aria-hidden="true" />
        )}
      </header>

      <OverallBar bus={bus} segments={segments} />

      {finished ? (
        <FinishSummary
          config={config}
          snap={snap}
          segments={segments}
          completed={finishReason !== 'end'}
          natural={finishReason === null}
          onRepeat={begin}
          onHome={goHome}
        />
      ) : (
        <div className="run__body">
          <main className="run__main">
            <div className="phase">
              <MiniRing bus={bus} value={ring} />
              <div className="phase__text">
                <h1 className="phase__label">{label}</h1>
                {detail && <p className="phase__detail">{detail}</p>}
              </div>
            </div>

            <div className="stage">
              <div className="stage__ring">
                <ProgressRing bus={bus} value={ring} />
              </div>
              <div className="stage__center">
                {status === 'paused' && <span className="chip chip--paused">Paused</span>}
                <div
                  className={`clock num${clock.final ? ' is-final' : ''}`}
                  role="timer"
                  aria-label={`${clock.down ? 'Remaining' : 'Elapsed'} ${clock.main}`}
                >
                  <span key={clock.final || 'x'} className="clock__digits">
                    {clock.main}
                    {clock.tenths !== undefined && <span className="clock__tenths">.{clock.tenths}</span>}
                  </span>
                </div>
                <SegmentBar bus={bus} value={ring} />
                {subInfo && <p className="stage__info num">{subInfo}</p>}
              </div>
            </div>
          </main>

          <aside className="run__side">
            {status === 'idle' ? (
              <ul className="overview" aria-label="Workout overview">
                {overview.map((o) => (
                  <li key={o} className="overview__chip">
                    {o}
                  </li>
                ))}
              </ul>
            ) : (
              (stats.length > 0 || snap.laps.length > 0) && (
                <div className="info">
                  {stats.length > 0 && (
                    <dl className="stats">
                      {stats.map((s) => (
                        <div key={s.label} className={`stats__cell${s.wide ? ' stats__cell--wide' : ''}`}>
                          <dt>{s.label}</dt>
                          <dd className="num">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {snap.laps.length > 0 && (
                    <SplitList
                      rows={snap.laps.map((l) => ({ index: l.index, atMs: l.atMs, splitMs: l.splitMs }))}
                      label="Laps"
                      newestFirst
                      limit={mode === 'stopwatch' ? 4 : 2}
                      tenths={settings.showTenths}
                    />
                  )}
                </div>
              )
            )}

            {status === 'idle' ? (
              <button type="button" className="start" onClick={begin}>
                <IconPlay size={34} />
                <span>Start</span>
              </button>
            ) : (
              <>
                {actions && <div className="actions">{actions}</div>}
                <div className="transport">
                  {left}
                  {playBtn}
                  {right}
                </div>
                {multiSeg && (
                  <div className="utility">
                    {resetBtn('pill hold', true)}
                    {!doneIsPrimary && endBtn}
                  </div>
                )}
              </>
            )}

            <p className="kbd-hint" aria-hidden="true">
              <kbd>Space</kbd> {status === 'idle' ? 'start' : 'pause'}
              {multiSeg && (
                <>
                  {' '}
                  · <kbd>←</kbd>
                  <kbd>→</kbd> segment
                </>
              )}
              {hasLaps && (
                <>
                  {' '}
                  · <kbd>L</kbd> lap
                </>
              )}
              {hasRounds && (
                <>
                  {' '}
                  · <kbd>R</kbd> round
                </>
              )}
              {fsSupported && (
                <>
                  {' '}
                  · <kbd>F</kbd> fullscreen
                </>
              )}{' '}
              · <kbd>Esc</kbd> back
            </p>
          </aside>
        </div>
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {sheet === 'leave' && (
        <Sheet title="Leave workout?" onClose={() => setSheet(null)}>
          <p className="sheet__text">The timer will stop. What you’ve done so far is saved to history.</p>
          <div className="sheet__actions">
            <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
              Keep going
            </button>
            <button type="button" className="btn btn--danger" onClick={leave}>
              Leave
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'reset' && (
        <Sheet title="Reset workout?" onClose={() => setSheet(null)}>
          <p className="sheet__text">The timer goes back to the start. Progress so far is saved to history.</p>
          <div className="sheet__actions">
            <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={doReset}>
              Reset
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'end' && (
        <Sheet title="End workout now?" onClose={() => setSheet(null)}>
          <p className="sheet__text">You’ll see your summary and the session is saved as ended early.</p>
          <div className="sheet__actions">
            <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={() => finishWith('end')}>
              End
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
