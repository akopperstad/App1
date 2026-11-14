import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';

const HOLD_MS = 900;

/**
 * Hold-to-confirm button. Pointer users hold for ~1s (a fill sweeps across);
 * keyboard / assistive-tech activation calls `onRequestConfirm` instead so
 * there's always a non-gesture path.
 */
export function HoldButton({
  children,
  className = '',
  label,
  disabled,
  requireHold,
  onConfirm,
  onRequestConfirm,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  disabled?: boolean;
  /** When false, a plain tap triggers onConfirm. */
  requireHold: boolean;
  onConfirm: () => void;
  onRequestConfirm: () => void;
}) {
  const { t } = useT();
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);
  const fired = useRef(false);
  const pointer = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      type="button"
      className={`${className}${holding ? ' is-holding' : ''}`}
      aria-label={requireHold ? t('ui.holdConfirm', { label }) : label}
      disabled={disabled}
      style={{ ['--hold-ms' as string]: `${HOLD_MS}ms` }}
      onPointerDown={(e) => {
        if (!requireHold || e.button !== 0) return;
        pointer.current = true;
        fired.current = false;
        setHolding(true);
        timer.current = window.setTimeout(() => {
          fired.current = true;
          setHolding(false);
          navigator.vibrate?.(30);
          onConfirm();
        }, HOLD_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (!requireHold) {
          onConfirm();
          return;
        }
        // Pointer-originated click: the hold logic already decided.
        if (pointer.current && e.detail > 0) {
          pointer.current = false;
          return;
        }
        pointer.current = false;
        if (!fired.current) onRequestConfirm();
      }}
    >
      <span className="hold__fill" aria-hidden="true" />
      {children}
    </button>
  );
}
