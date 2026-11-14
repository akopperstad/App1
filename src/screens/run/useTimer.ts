import { useEffect, useRef, useState } from 'react';
import type { TimerEngine } from '../../engine/engine';
import type { Snapshot } from '../../engine/types';
import { onAppResume } from '../../native/app';

/** Per-frame painters (ring, progress bars) that write to the DOM directly, bypassing React. */
export interface FrameBus {
  add(fn: (s: Snapshot) => void): () => void;
  emit(s: Snapshot): void;
  last: Snapshot | null;
}

export function createFrameBus(): FrameBus {
  const fns = new Set<(s: Snapshot) => void>();
  const bus: FrameBus = {
    last: null,
    add(fn) {
      fns.add(fn);
      if (bus.last) fn(bus.last);
      return () => fns.delete(fn);
    },
    emit(s) {
      bus.last = s;
      fns.forEach((f) => f(s));
    },
  };
  return bus;
}

/**
 * Drives the engine:
 *  - requestAnimationFrame loop while running and visible (smooth ring/bars via the FrameBus),
 *  - a 100 ms interval so cues still fire when rAF is not running (hidden tab / locked screen),
 *  - an immediate tick when the page becomes visible again,
 *  - engine.subscribe for discrete changes (start, pause, laps, rounds...).
 * React state only updates when `keyOf(snapshot)` changes, i.e. when something visible changes.
 */
export function useTimer(engine: TimerEngine, keyOf: (s: Snapshot) => string, bus: FrameBus): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(() => engine.snapshot());
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;

  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    let alive = true;

    const publish = (s: Snapshot, force: boolean) => {
      const k = keyRef.current(s);
      if (force || k !== lastKey) {
        lastKey = k;
        setSnap(s);
      }
      bus.emit(s);
    };

    const update = () => {
      if (!alive) return;
      publish(engine.tick(), false);
    };

    const frame = () => {
      raf = 0;
      update();
      schedule();
    };

    const schedule = () => {
      if (!alive || raf) return;
      if (engine.getStatus() !== 'running') return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      raf = requestAnimationFrame(frame);
    };

    // Discrete changes. Never call tick() from here: this fires *inside* tick().
    const unsub = engine.subscribe(() => {
      if (!alive) return;
      publish(engine.snapshot(), true);
      schedule();
    });

    // Background driver for cues when rAF is not running (hidden tab, rAF
    // throttled). Pages that recently played audio are usually exempt from
    // timer throttling, so 100 ms keeps worst-case beep latency low there; in
    // the foreground the rAF loop already ticks, so this does nothing.
    const iv = window.setInterval(() => {
      if (!raf && engine.getStatus() === 'running') update();
    }, 100);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        update();
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // Native app: tick at once on resume (the web view may not fire visibilitychange).
    const offResume = onAppResume(() => {
      update();
      schedule();
    });

    publish(engine.snapshot(), true);
    schedule();

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(iv);
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      offResume();
    };
  }, [engine, bus]);

  return snap;
}
