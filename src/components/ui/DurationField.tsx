import { useState } from 'react';
import { useT } from '../../i18n';
import { mmss } from '../../lib/format';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Stepper, clamp } from './Stepper';

export const CHIPS_SHORT = [5, 10, 15, 20, 30, 45, 60, 90, 120];
export const CHIPS_WORK = [10, 20, 30, 40, 45, 60, 90, 120, 180, 240];
export const CHIPS_LONG = [60, 120, 300, 600, 720, 900, 1200, 1500, 1800, 2400];
export const CHIPS_REST = [0, 10, 15, 20, 30, 45, 60, 90, 120, 180];

export interface DurationFieldProps {
  value: number;
  onChange: (sec: number) => void;
  /** Field name, used for the sheet title and accessible label. */
  label: string;
  min?: number;
  max?: number;
  /** Quick-pick values in seconds. */
  chips?: number[];
  /** Custom labels for particular chip values, e.g. {60: 'EMOM'}. */
  chipLabels?: Record<number, string>;
  /** Seconds increment for the seconds stepper. */
  secStep?: number;
  /** Label displayed when the value is 0 (e.g. "Off", "None"). */
  zeroLabel?: string;
  disabled?: boolean;
}

function chipText(sec: number, zeroLabel?: string) {
  if (sec === 0) return zeroLabel ?? '0:00';
  return mmss(sec);
}

/** Tappable m:ss value that opens a picker sheet with steppers and quick chips. */
export function DurationField({
  value,
  onChange,
  label,
  min = 0,
  max = 99 * 60 + 59,
  chips = CHIPS_WORK,
  chipLabels,
  secStep = 5,
  zeroLabel,
  disabled,
}: DurationFieldProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const set = (v: number) => onChange(clamp(Math.round(v), min, max));
  const shown = value === 0 && zeroLabel ? zeroLabel : mmss(value);
  const visibleChips = chips.filter((c) => c >= min && c <= max);

  return (
    <>
      <button
        type="button"
        className={`ui-duration${value === 0 && zeroLabel ? ' is-zero' : ''}`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={t('ui.durationChange', { label, value: shown })}
      >
        <span className="num">{shown}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <Button variant="primary" size="lg" block onClick={() => setOpen(false)} data-autofocus>
            {t('common.done')}
          </Button>
        }
      >
        <div className="ui-dpick">
          <div className="ui-dpick__display num" aria-live="polite">
            {value === 0 && zeroLabel ? zeroLabel : mmss(value)}
          </div>
          <div className="ui-dpick__cols">
            <div className="ui-dpick__col">
              <span className="ui-dpick__cap">{t('ui.minutes')}</span>
              <Stepper
                label={t('ui.minutes')}
                value={value}
                step={60}
                min={min}
                max={max}
                format={(v) => String(Math.floor(v / 60))}
                onChange={set}
              />
            </div>
            <div className="ui-dpick__col">
              <span className="ui-dpick__cap">{t('ui.seconds')}</span>
              <Stepper
                label={t('ui.seconds')}
                value={value}
                step={secStep}
                min={min}
                max={max}
                format={(v) => String(v % 60).padStart(2, '0')}
                onChange={set}
              />
            </div>
          </div>
          {visibleChips.length > 0 && (
            <>
              <span className="ui-dpick__cap">{t('ui.quickPick')}</span>
              <div className="ui-chips">
                {visibleChips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ui-chip num${c === value ? ' is-active' : ''}`}
                    aria-pressed={c === value}
                    onClick={() => {
                      set(c);
                      setOpen(false);
                    }}
                  >
                    {chipLabels?.[c] ? (
                      <>
                        <strong>{chipLabels[c]}</strong>
                        <small>{chipText(c, zeroLabel)}</small>
                      </>
                    ) : (
                      chipText(c, zeroLabel)
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
