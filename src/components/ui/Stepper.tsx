import { useRef } from 'react';
import { useT } from '../../i18n';
import { Icon } from './Icon';
import { useHoldRepeat } from './useHoldRepeat';

export interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name, e.g. "Rounds". */
  label: string;
  format?: (v: number) => string;
  /** Small unit shown after the value, e.g. "reps". */
  unit?: string;
  size?: 'md' | 'lg';
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** − value + with press-and-hold accelerating auto-repeat. */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, format, unit, size = 'md' }: StepperProps) {
  // Track the latest value locally so rapid repeats never use a stale prop.
  const { t } = useT();
  const live = useRef(value);
  live.current = value;

  const bump = (dir: 1 | -1) => (mult: number) => {
    const next = clamp(live.current + dir * step * mult, min, max);
    if (next !== live.current) {
      live.current = next;
      onChange(next);
    }
  };

  const dec = useHoldRepeat(bump(-1), value <= min);
  const inc = useHoldRepeat(bump(1), value >= max);

  return (
    <div
      className={`ui-stepper ui-stepper--${size}`}
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          bump(1)(1);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          bump(-1)(1);
        }
      }}
    >
      <button type="button" className="ui-stepper__btn" aria-label={t('ui.decrease', { label })} disabled={value <= min} {...dec}>
        <Icon name="minus" size={20} />
      </button>
      <output className="ui-stepper__value num" aria-live="polite">
        {format ? format(value) : value}
        {unit && <span className="ui-stepper__unit">{unit}</span>}
      </output>
      <button type="button" className="ui-stepper__btn" aria-label={t('ui.increase', { label })} disabled={value >= max} {...inc}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
