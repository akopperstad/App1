import { useRef, type PointerEvent } from 'react';

/**
 * Tap vs long-press on the same element. Returns handlers to spread on a
 * button. `onTap` also fires for keyboard activation (Enter / Space).
 */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = undefined;
        if ('vibrate' in navigator) navigator.vibrate?.(10);
        onLong();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      clear();
      // Desktop right-click, or a touch long-press the timer hasn't caught yet.
      if (!fired.current) {
        fired.current = true;
        onLong();
      }
    },
    onKeyDown: () => {
      fired.current = false;
    },
  };
}
