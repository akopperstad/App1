import { useEffect, useMemo, useRef } from 'react';
import type { Segment, Snapshot } from '../../engine/types';
import type { FrameBus } from './useTimer';

/**
 * All progress visuals are painted straight to the DOM from the frame bus so
 * they animate at display rate without re-rendering React.
 */
function usePaint(bus: FrameBus, value: (s: Snapshot) => number, write: (v: number) => void) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const writeRef = useRef(write);
  writeRef.current = write;
  useEffect(() => {
    let last = -1;
    return bus.add((s) => {
      const v = Math.max(0, Math.min(1, valueRef.current(s)));
      if (Math.abs(v - last) < 0.0004) return;
      last = v;
      writeRef.current(v);
    });
  }, [bus]);
}

export function ProgressRing({ bus, value }: { bus: FrameBus; value: (s: Snapshot) => number }) {
  const arc = useRef<SVGCircleElement>(null);
  usePaint(bus, value, (v) => {
    const el = arc.current;
    if (!el) return;
    el.style.strokeDashoffset = String(100 - v * 100);
    el.style.opacity = v <= 0.002 ? '0' : '1';
  });
  return (
    <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="ring__track" cx="50" cy="50" r="46.5" />
      <circle className="ring__ticks" cx="50" cy="50" r="42" pathLength={120} />
      <circle ref={arc} className="ring__arc" cx="50" cy="50" r="46.5" pathLength={100} />
    </svg>
  );
}

/** Mini ring used next to the phase label in wide layouts. */
export function MiniRing({ bus, value }: { bus: FrameBus; value: (s: Snapshot) => number }) {
  const arc = useRef<SVGCircleElement>(null);
  usePaint(bus, value, (v) => {
    if (arc.current) arc.current.style.strokeDashoffset = String(100 - v * 100);
  });
  return (
    <svg className="mini-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="mini-ring__track" cx="18" cy="18" r="14" />
      <circle ref={arc} className="mini-ring__arc" cx="18" cy="18" r="14" pathLength={100} />
    </svg>
  );
}

/** Horizontal segment-progress bar used under the clock in wide layouts. */
export function SegmentBar({ bus, value }: { bus: FrameBus; value: (s: Snapshot) => number }) {
  const fill = useRef<HTMLDivElement>(null);
  usePaint(bus, value, (v) => {
    if (fill.current) fill.current.style.transform = `scaleX(${v})`;
  });
  return (
    <div className="seg-bar" aria-hidden="true">
      <div ref={fill} className="seg-bar__fill" />
    </div>
  );
}

/** Thin overall progress bar with one block per (non-prep) segment. */
export function OverallBar({ bus, segments }: { bus: FrameBus; segments: readonly Segment[] }) {
  const lit = useRef<HTMLDivElement>(null);
  const work = useMemo(() => segments.filter((s) => s.kind !== 'prep'), [segments]);
  const total = work.reduce((a, s) => a + (s.durationMs ?? 0), 0);
  const known = work.every((s) => s.durationMs !== null) && total > 0;
  const blocks = work.length <= 80;

  usePaint(
    bus,
    (s) => s.overallProgress,
    (v) => {
      if (lit.current) lit.current.style.clipPath = `inset(0 ${(1 - v) * 100}% 0 0)`;
    },
  );

  if (!known) return <div className="overall overall--empty" aria-hidden="true" />;

  const layer = (cls: string) => (
    <div className={`overall__layer ${cls}`}>
      {blocks ? (
        work.map((s, i) => (
          <span key={i} className={`overall__seg overall__seg--${s.kind}`} style={{ flexGrow: s.durationMs ?? 0 }} />
        ))
      ) : (
        <span className="overall__seg overall__seg--work" style={{ flexGrow: 1 }} />
      )}
    </div>
  );

  return (
    <div className="overall" aria-hidden="true">
      {layer('overall__layer--dim')}
      <div ref={lit} className="overall__lit" style={{ clipPath: 'inset(0 100% 0 0)' }}>
        {layer('overall__layer--lit')}
      </div>
    </div>
  );
}
