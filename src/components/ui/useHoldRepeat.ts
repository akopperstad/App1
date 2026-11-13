import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Press-and-hold auto-repeat with acceleration. Returns props to spread onto a
 * <button>. A single click (mouse, touch or keyboard) fires once; holding
 * fires repeatedly, getting faster the longer it is held.
 */
export function useHoldRepeat(fire: (multiplier: number) => void, disabled?: boolean) {
  const fireRef = useRef(fire);
  fireRef.current = fire;
  const timer = useRef<number | undefined>(undefined);
  const pointerFired = useRef(false);

  const stop = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    pointerFired.current = true;
    fireRef.current(1);
    let count = 0;
    const loop = (delay: number) => {
      timer.current = window.setTimeout(() => {
        count++;
        const mult = count > 30 ? 5 : count > 14 ? 2 : 1;
        fireRef.current(mult);
        loop(Math.max(45, delay * 0.86));
      }, delay);
    };
    stop();
    timer.current = window.setTimeout(() => loop(110), 380);
  };

  const onClick = () => {
    if (pointerFired.current) {
      pointerFired.current = false;
      return;
    }
    if (!disabled) fireRef.current(1);
  };

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
