import { useT } from '../../i18n';
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
  const { t, tp } = useT();
  const last = times.length ? times[times.length - 1] - (times[times.length - 2] ?? 0) : null;
  const done = target ? count >= target : false;
  return (
    <div className="rounds">
      <button
        type="button"
        className={`tile tile--rounds${done ? ' is-target' : ''}`}
        onClick={onTap}
        disabled={disabled}
        aria-label={target ? t('rc.ariaTarget', { n: count, target }) : tp('rc.aria', count)}
      >
        <span className="rounds__count num">
          {count}
          {target ? <span className="rounds__target"> / {target}</span> : null}
        </span>
        <span className="rounds__meta">
          <span className="rounds__cta">
            <IconPlus size={18} /> {t('rc.round')}
          </span>
          <span className="rounds__split num">
            {last !== null ? t('rc.last', { time: formatClockString(last) }) : t('rc.tap')}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="tile tile--undo"
        onClick={onUndo}
        disabled={count === 0}
        aria-label={t('rc.undo')}
      >
        <IconUndo size={22} />
      </button>
    </div>
  );
}
