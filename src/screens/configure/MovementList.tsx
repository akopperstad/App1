import { useRef } from 'react';
import { Button, IconButton } from '../../components/ui';
import { isRestWord, useT } from '../../i18n';

export interface MovementListProps {
  value: string[];
  onChange: (v: string[]) => void;
  /** What a row rotates with: each EMOM interval, or each work round. */
  unit: 'interval' | 'round';
  allowRest?: boolean;
  max?: number;
}

/** Editable, reorderable list of movement names that rotate each round. */
export function MovementList({ value, onChange, unit, allowRest = true, max = 20 }: MovementListProps) {
  const { t } = useT();
  const listRef = useRef<HTMLOListElement>(null);

  const focusLast = () =>
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll('input');
      inputs?.[inputs.length - 1]?.focus();
    });

  const set = (i: number, v: string) => onChange(value.map((m, j) => (j === i ? v : m)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="cfg-moves">
      {value.length > 0 && (
        <ol className="cfg-moves__list" ref={listRef}>
          {value.map((m, i) => {
            const isRest = isRestWord(m);
            return (
              <li key={i} className={`cfg-moves__item${isRest ? ' is-rest' : ''}`}>
                <span className="cfg-moves__idx num" aria-hidden>
                  {i + 1}
                </span>
                <input
                  className="ui-input cfg-moves__input"
                  value={m}
                  placeholder={t('mv.placeholder', { n: i + 1 })}
                  aria-label={t('mv.placeholder', { n: i + 1 })}
                  maxLength={40}
                  enterKeyHint="next"
                  onChange={(e) => set(i, e.target.value)}
                />
                <div className="cfg-moves__tools">
                  <IconButton icon="chevronUp" label={t('mv.up', { n: i + 1 })} size={18} disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton
                    icon="chevronDown"
                    label={t('mv.down', { n: i + 1 })}
                    size={18}
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton icon="close" label={t('mv.remove', { n: i + 1 })} size={18} onClick={() => remove(i)} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="cfg-moves__add">
        <Button
          variant="ghost"
          icon="plus"
          disabled={value.length >= max}
          onClick={() => {
            onChange([...value, '']);
            focusLast();
          }}
        >
          {t('mv.add')}
        </Button>
        {allowRest && (
          <Button variant="ghost" icon="plus" disabled={value.length >= max} onClick={() => onChange([...value, t('seg.rest')])}>
            {t('mv.addRest')}
          </Button>
        )}
      </div>
      <p className="cfg-moves__hint">
        {value.length === 0
          ? t(unit === 'interval' ? 'mv.empty.interval' : 'mv.empty.round')
          : value.length > 1
            ? t(unit === 'interval' ? 'mv.rotateN.interval' : 'mv.rotateN.round', { n: value.length })
            : t(unit === 'interval' ? 'mv.rotate.interval' : 'mv.rotate.round')}
      </p>
    </div>
  );
}
