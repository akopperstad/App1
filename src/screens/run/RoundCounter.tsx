import { formatClockString } from '../../lib/format';
import { IconPlus, IconUndo } from './icons';

interface Props {
  count: number;
  times: number[];
  target?: number;
  disabled?: boolean;
  onTap: () => void;
  onUndo: () => void;
}

/** Big "+1 Round" tile with the running count, last split and undo. */
export function RoundCounter({ count, times, target, disabled, onTap, onUndo }: Props) {
  const last = times.length ? times[times.length - 1] - (times[times.length - 2] ?? 0) : null;
  const done = target ? count >= target : false;
  return (
    <div className="rounds">
      <button
        type="button"
        className={`tile tile--rounds${done ? ' is-target' : ''}`}
        onClick={onTap}
        disabled={disabled}
        aria-label={`Add round. ${count} round${count === 1 ? '' : 's'} so far${target ? ` of ${target}` : ''}`}
      >
        <span className="rounds__count num">
          {count}
          {target ? <span className="rounds__target"> / {target}</span> : null}
        </span>
        <span className="rounds__meta">
          <span className="rounds__cta">
            <IconPlus size={18} /> Round
          </span>
          <span className="rounds__split num">
            {last !== null ? `last ${formatClockString(last)}` : 'tap each round'}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="tile tile--undo"
        onClick={onUndo}
        disabled={count === 0}
        aria-label="Undo last round"
      >
        <IconUndo size={22} />
      </button>
    </div>
  );
}
