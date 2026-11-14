import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cuePlayer } from '../audio/cues';
import { compile } from '../engine/compile';
import { TimerEngine } from '../engine/engine';
import { describe, modeInfo, modeTagline, modeTitle, totalSeconds } from '../engine/modes';
import { normalizeConfig } from '../engine/normalize';
import type { Cue, SegmentKind, Snapshot, WorkoutConfig } from '../engine/types';
import { getT, useT } from '../i18n';
import { formatClock, formatDuration } from '../lib/format';
import { resetThemeColor, setThemeColor } from '../lib/themeColor';
import { useWakeLock } from '../lib/wakeLock';
import { useBackgroundCues } from '../native/useBackgroundCues';
import { useStatusBarOverride } from '../native/systemUi';
import { useNav } from '../nav';
import { saveHistory, settingsStore, useSettings } from '../state/store';
import {
  announceFor,
  clockModel,
  displayKey,
  firstWork,
  isUpNextRest,
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

export function Run({ config: rawConfig }: { config: WorkoutConfig }) {
  const nav = useNav();
  const settings = useSettings();
  // Configs can come from storage (history / presets); never let a malformed one crash the run.
  const [config] = useState<WorkoutConfig>(() => normalizeConfig(rawConfig) ?? { mode: 'stopwatch' });
  const info = modeInfo(config.mode);
  const tr = useT();
  const { t, tp } = tr;
  const modeName = modeTitle(config.mode, tr);

  // ------------------------------------------------------------ engine
  const cueRef = useRef<(cue: Cue) => void>(() => {});
  /** False once the screen is gone: a discarded / paused-on-unmount engine must stay silent. */
  const mounted = useRef(false);
  const [engine] = useState(
    () =>
      // The workout's language is fixed when it starts: labels are compiled once.
      new TimerEngine(compile(config, settingsStore.get().prepSec, getT()), {
        onCue: (c) => {
          if (mounted.current) cueRef.current(c);
        },
      }),
  );
  const [bus] = useState(createFrameBus);
  const segments = engine.getSegments();
  const idleSeg = useMemo(() => firstWork(segments), [segments]);
  const workSegCount = useMemo(() => segments.filter((s) => s.kind !== 'prep').length, [segments]);
  const multiSeg = workSegCount > 1;

  const keyOf = useCallback((s: Snapshot) => displayKey(s, config, settingsStore.get(), idleSeg), [config, idleSeg]);
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
        setAnnounce(announceFor(cue.segment, config, getT()));
        break;
      case 'start':
        setAnnounce(announceFor(cue.segment, config, getT()));
        break;
      case 'finish':
        setAnnounce(getT().t('run.complete'));
        break;
      case 'pause':
        setAnnounce(getT().t('run.paused'));
        break;
      case 'resume':
        setAnnounce(getT().t('run.resumed'));
        break;
    }
  };

  // ------------------------------------------------------------ session / history
  /**
   * The session being recorded. `entryId` is set once something was written to
   * history (a checkpoint or the final result); later writes update that entry
   * in place, so a session is never stored twice. `final` = result recorded.
   */
  const session = useRef<{ startedAt: number | null; entryId: string | null; final: boolean; reason: FinishReason }>({
    startedAt: null,
    entryId: null,
    final: false,
    reason: null,
  });
  const [finishReason, setFinishReason] = useState<FinishReason>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const persist = useCallback(
    (completed: boolean, natural: boolean, final = true) => {
      const ses = session.current;
      if (ses.final || ses.startedAt === null) return;
      const s = engine.snapshot();
      if (!completed && s.workElapsedMs < 5000 && ses.entryId === null) return;
      ses.entryId = saveHistory(ses.entryId, buildEntry(config, s, engine.getSegments(), ses.startedAt, completed, natural));
      if (final) ses.final = true;
    },
    [engine, config],
  );

  useEffect(() => {
    if (status !== 'finished') return;
    const reason = session.current.reason;
    persist(reason !== 'end', reason === null);
  }, [status, persist]);

  // Leaving by hardware back / unmount: keep what was done, and go quiet.
  // Page hidden / closing: checkpoint the session (mobile browsers may kill a
  // backgrounded PWA without ever firing pagehide); the final result later
  // overwrites the checkpoint instead of adding a second entry.
  useEffect(() => {
    mounted.current = true;
    const checkpoint = () => {
      const st = engine.getStatus();
      if (st === 'running' || st === 'paused') persist(false, false, false);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') checkpoint();
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', onVis);
      // Silence first: pausing on the way out must not click, and no queued
      // announcement ("Ten seconds") may outlive the screen.
      mounted.current = false;
      const st = engine.getStatus();
      if (st === 'running' || st === 'paused') {
        persist(false, false);
        engine.pause();
      }
      cuePlayer.stop();
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
  useBackgroundCues(engine); // native: notifications at segment boundaries while locked/backgrounded

  // ------------------------------------------------------------ actions
  const begin = useCallback(() => {
    cuePlayer.unlock(); // must stay synchronous inside the user gesture (iOS)
    const st = engine.getStatus();
    if (st === 'finished') {
      // Repeat: make sure the finished session is recorded before starting over
      // (no-op if the finish effect already saved it).
      const reason = session.current.reason;
      persist(reason !== 'end', reason === null);
      engine.reset();
    }
    if (st === 'idle' || st === 'finished') {
      session.current = { startedAt: Date.now(), entryId: null, final: false, reason: null };
      setFinishReason(null);
    }
    engine.start();
  }, [engine, persist]);

  const toggle = useCallback(() => {
    if (engine.getStatus() === 'running') engine.pause();
    else begin();
  }, [engine, begin]);

  const doReset = useCallback(() => {
    persist(false, false);
    engine.reset();
    cuePlayer.stop();
    session.current = { startedAt: null, entryId: null, final: false, reason: null };
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

  /** Count a round; For Time with a target finishes on the final round. */
  const tapRound = useCallback(() => {
    engine.tapRound();
    if (
      config.mode === 'fortime' &&
      config.targetRounds > 0 &&
      engine.snapshot().roundsTapped >= config.targetRounds
    ) {
      finishWith('done');
    }
  }, [engine, config, finishWith]);

  const goHome = useCallback(() => {
    const depth = typeof history.state?.depth === 'number' ? history.state.depth : 0;
    if (depth > 0) history.go(-depth);
    else nav.replace({ name: 'home' });
  }, [nav]);

  const leave = useCallback(() => {
    persist(false, false);
    engine.setCueHandler(undefined); // leaving: no pause click / speech
    cuePlayer.stop();
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
  /** "Big clock" focus mode: tap the clock to hide secondary chrome. */
  const [focus, setFocus] = useState(false);
  const toggleFocus = useCallback(() => setFocus((f) => !f), []);

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
    finished: boolean;
  } | null>(null);
  keys.current = {
    toggle,
    // Single-segment modes have no segment navigation: → would silently finish
    // (and save) a stopwatch, ← would restart it. Only "skip get ready" applies.
    next: () => {
      if (multiSeg || inPrep) engine.next();
    },
    prev: () => {
      if (multiSeg) engine.previous();
    },
    lap: () => {
      if (hasLaps && seg.kind !== 'prep') engine.lap();
    },
    round: () => {
      if (hasRounds && seg.kind !== 'prep') tapRound();
    },
    back: requestBack,
    fs: toggleFs,
    sheetOpen: sheet !== null,
    finished: status === 'finished',
  };
  useEffect(() => {
    const ignore = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return true;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return true;
      // Any modal sheet (ours or a child's, e.g. "save as preset" on the summary) owns the keyboard.
      return !!keys.current?.sheetOpen || !!document.querySelector('[aria-modal="true"]');
    };
    /** Whether we took the last Space keydown (so its keyup must not also "click" a focused button). */
    let spaceTaken = false;
    const onDown = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === ' ') spaceTaken = false;
      if (!k || e.defaultPrevented || ignore(e)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      // On the summary only Esc is global; Space / Enter activate the focused button natively.
      if (k.finished && key !== 'Escape') return;
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
      if (handled) {
        e.preventDefault();
        if (key === ' ') spaceTaken = true;
      }
    };
    // Stop a focused button from also "clicking" on Space keyup.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && spaceTaken) {
        spaceTaken = false;
        e.preventDefault();
      }
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
  const ring = useCallback((s: Snapshot) => ringValue(s, config, settingsStore.get(), idleSeg), [config, idleSeg]);

  const label = status === 'idle' ? modeName : phaseLabel(seg, tr);
  const detail = status === 'idle' ? modeTagline(config.mode, tr) : seg.detail && !isUpNextRest(seg) ? seg.detail : undefined;
  const subInfo =
    status === 'idle'
      ? ''
      : seg.kind === 'prep'
        ? describe(config, tr) // the mode name is already in the top bar
        : roundInfo(seg, config, tr) || (seg.detail && isUpNextRest(seg) ? seg.detail : '');

  const planned = snap.plannedWorkMs;
  const stats: { label: string; value: string; wide?: boolean }[] = [];
  if (status !== 'idle') {
    // Single-segment modes: only show the figure the big clock isn't already showing.
    const showElapsed = seg.kind !== 'prep' && (multiSeg || clock.down);
    const showRemaining = planned !== null && mode !== 'deathby' && (multiSeg || seg.kind === 'prep' || !clock.down);
    if (showElapsed) stats.push({ label: t('run.elapsed'), value: formatClock(snap.workElapsedMs).main });
    if (showRemaining) {
      stats.push({
        label: seg.kind === 'prep' ? t('run.total') : mode === 'fortime' ? t('run.toCap') : t('run.remaining'),
        // Plan position, not wall clock: stays right after ← / → / +time.
        value: formatClock(snap.remainingWorkMs ?? planned, { roundUp: true }).main,
      });
    }
    if (snap.next && multiSeg) {
      stats.push({ label: t('run.nextUp'), value: `${segmentShort(snap.next, tr)} · ${segmentTime(snap.next, tr)}`, wide: true });
    } else if (multiSeg && !snap.next) {
      stats.push({ label: t('run.nextUp'), value: t('run.finish'), wide: true });
    }
  }

  const total = totalSeconds(config);
  const overview: string[] = [];
  const summary = describe(config, tr);
  if (total === null || summary !== formatDuration(total, tr)) overview.push(summary);
  if (total !== null) overview.push(t('run.totalD', { d: formatDuration(total, tr) }));
  else overview.push(t('run.openEnded'));
  if (workSegCount > 1) overview.push(tp('run.segments', workSegCount));
  if (segments[0].kind === 'prep') overview.push(t('run.prepD', { d: formatDuration((segments[0].durationMs ?? 0) / 1000, tr) }));

  const style = { '--accent': info.accent, '--em': clock.em } as CSSProperties;
  const finished = status === 'finished';

  // Light theme: while a phase colour fills the screen (see Run.css "bold surface"),
  // the browser bar (theme-color) and native status-bar icons follow it.
  const tinted = active && document.documentElement.dataset.theme === 'light';
  useStatusBarOverride(tinted ? (status === 'running' && phase === 'prep' ? 'dark' : 'light') : null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!tinted || !el) {
      resetThemeColor();
      return;
    }
    const read = () => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      // Paused is a color-mix() (may serialise as color(srgb …)); fall back to the phase token.
      setThemeColor(/^(rgb|#)/.test(bg) ? bg : cs.getPropertyValue('--ph').trim() || bg);
    };
    read();
    // --ph animates between phases (600ms): settle on the final colour.
    const raf = requestAnimationFrame(read);
    const late = window.setTimeout(read, 650);
    el.addEventListener('transitionend', read);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      el.removeEventListener('transitionend', read);
    };
  }, [tinted, phase, status]);
  useEffect(() => () => resetThemeColor(), []);

  // ------------------------------------------------------------ pieces
  const playBtn = (
    <button
      type="button"
      className={`transport__play${status === 'paused' ? ' is-paused' : ''}`}
      onClick={toggle}
      aria-label={status === 'running' ? t('run.pause') : t('run.resume')}
    >
      {status === 'running' ? <IconPause size={44} /> : <IconPlay size={44} />}
    </button>
  );

  const resetBtn = (cls: string, withLabel: boolean) => (
    <HoldButton
      className={cls}
      label={t('run.reset')}
      requireHold={active}
      disabled={status === 'idle'}
      onConfirm={doReset}
      onRequestConfirm={() => setSheet('reset')}
    >
      <IconReset size={withLabel ? 20 : 26} />
      {withLabel && <span>{t('run.holdReset')}</span>}
    </HoldButton>
  );

  const endBtn = (
    <HoldButton
      className="pill"
      label={t('run.endWorkout')}
      requireHold={active}
      disabled={!active}
      onConfirm={() => finishWith('end')}
      onRequestConfirm={() => setSheet('end')}
    >
      <IconStop size={18} />
      <span>{t('run.holdEnd')}</span>
    </HoldButton>
  );

  const doneCircle = (
    <button
      type="button"
      className="transport__side transport__done"
      onClick={() => finishWith('done')}
      disabled={!active || inPrep}
      aria-label={t('run.doneAria')}
    >
      <IconCheck size={30} />
    </button>
  );

  const lapTile = (
    <button type="button" className="tile tile--icon" onClick={() => engine.lap()} disabled={inPrep} aria-label={t('run.lap')}>
      <IconFlag size={24} />
      {snap.laps.length > 0 && <span className="tile__badge num">{snap.laps.length}</span>}
    </button>
  );

  let actions: ReactNode = null;
  if (active) {
    if (untimedStep) {
      actions = (
        <button type="button" className="tile tile--next" onClick={() => engine.next()}>
          <span>{isLastSeg ? t('run.finish') : t('run.stepDone')}</span>
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
            onTap={tapRound}
            onUndo={() => engine.undoRound()}
          />
          {mode === 'fortime' && lapTile}
        </>
      );
    } else if (mode === 'stopwatch') {
      actions = (
        <button type="button" className="tile tile--lap" onClick={() => engine.lap()} disabled={inPrep}>
          <IconFlag size={26} />
          <span>{t('run.lap')}</span>
          {snap.laps.length > 0 && <span className="tile__badge num">{snap.laps.length}</span>}
        </button>
      );
    } else if (canAdjust) {
      actions = (
        <div className="adjust" role="group" aria-label={t('run.adjust')}>
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
      <button type="button" className="transport__side" onClick={() => engine.previous()} aria-label={t('run.prev')}>
        <IconPrev size={28} />
      </button>
    );
    right = (
      <button type="button" className="transport__side" onClick={() => engine.next()} aria-label={t('run.next')}>
        <IconNext size={28} />
      </button>
    );
  } else {
    left = resetBtn('transport__side hold', false);
    if (inPrep) {
      right = (
        <button type="button" className="transport__side" onClick={() => engine.next()} aria-label={t('run.skipPrep')}>
          <IconNext size={28} />
        </button>
      );
    } else if (doneIsPrimary) {
      right = doneCircle;
    } else if (mode === 'countdown' || mode === 'amrap') {
      right = (
        <HoldButton
          className="transport__side hold"
          label={t('run.end')}
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
    <div ref={rootRef} className="run" data-phase={phase} data-status={status} data-tinted={tinted ? '' : undefined} data-focus={focus && active ? '' : undefined} style={style}>
      <div className="run__bg" aria-hidden="true" />
      {clock.final > 0 && <div key={`beat-${clock.final}`} className="run__beat" aria-hidden="true" />}
      {flash && settings.flashOnChange && (
        <div key={`flash-${flash.n}`} className={`run__flash run__flash--${flash.kind}`} aria-hidden="true" />
      )}

      <header className="run__top">
        <button type="button" className="icon-btn" onClick={requestBack} aria-label={t('common.back')}>
          <IconBack size={26} />
        </button>
        <div className="run__title">
          <span className="run__name">{config.name?.trim() || modeName}</span>
          {status !== 'idle' && !finished && <span className="run__mode">{describe(config, tr)}</span>}
        </div>
        {fsSupported ? (
          <button
            type="button"
            className="icon-btn"
            onClick={toggleFs}
            aria-label={isFs ? t('run.exitFs') : t('run.fs')}
            aria-pressed={isFs}
          >
            {isFs ? <IconShrink size={22} /> : <IconExpand size={22} />}
          </button>
        ) : active ? (
          <button
            type="button"
            className="icon-btn"
            onClick={toggleFocus}
            aria-label={t('run.bigClock')}
            aria-pressed={focus}
          >
            {focus ? <IconShrink size={22} /> : <IconExpand size={22} />}
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

            <div className="stage" onClick={active ? toggleFocus : undefined}>
              <div className="stage__ring">
                <ProgressRing bus={bus} value={ring} />
              </div>
              <div className="stage__center">
                {status === 'paused' && <span className="chip chip--paused">{t('run.paused')}</span>}
                <div
                  className={`clock num${clock.final ? ' is-final' : ''}`}
                  role="timer"
                  aria-label={t(clock.down ? 'run.clockRemaining' : 'run.clockElapsed', { time: clock.main })}
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
              <ul className="overview" aria-label={t('run.overview')}>
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
                      label={t('run.laps')}
                      kind="lap"
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
                <span>{t('common.start')}</span>
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
                    {doneIsPrimary ? (
                      <button
                        type="button"
                        className="pill pill--done"
                        onClick={() => finishWith('done')}
                        disabled={!active || inPrep}
                      >
                        <IconCheck size={18} />
                        <span>{t('run.done')}</span>
                      </button>
                    ) : (
                      endBtn
                    )}
                  </div>
                )}
              </>
            )}

            <p className="kbd-hint" aria-hidden="true">
              <kbd>{t('kbd.space')}</kbd> {status === 'idle' ? t('kbd.start') : t('kbd.pause')}
              {multiSeg && (
                <>
                  {' '}
                  · <kbd>←</kbd>
                  <kbd>→</kbd> {t('kbd.segment')}
                </>
              )}
              {hasLaps && (
                <>
                  {' '}
                  · <kbd>L</kbd> {t('kbd.lap')}
                </>
              )}
              {hasRounds && (
                <>
                  {' '}
                  · <kbd>R</kbd> {t('kbd.round')}
                </>
              )}
              {fsSupported && (
                <>
                  {' '}
                  · <kbd>F</kbd> {t('kbd.fs')}
                </>
              )}{' '}
              · <kbd>Esc</kbd> {t('kbd.back')}
            </p>
          </aside>
        </div>
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      <Sheet open={sheet === 'leave'} title={t('run.leaveTitle')} onClose={() => setSheet(null)}>
        <p className="sheet__text">{t('run.leaveBody')}</p>
        <div className="sheet__actions">
          <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
            {t('run.keepGoing')}
          </button>
          <button type="button" className="btn btn--danger" onClick={leave}>
            {t('run.leave')}
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'reset'} title={t('run.resetTitle')} onClose={() => setSheet(null)}>
        <p className="sheet__text">{t('run.resetBody')}</p>
        <div className="sheet__actions">
          <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--danger" onClick={doReset}>
            {t('run.reset')}
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'end'} title={t('run.endTitle')} onClose={() => setSheet(null)}>
        <p className="sheet__text">{t('run.endBody')}</p>
        <div className="sheet__actions">
          <button type="button" className="btn" data-autofocus onClick={() => setSheet(null)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--danger" onClick={() => finishWith('end')}>
            {t('run.end')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
