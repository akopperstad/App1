import type { CustomStep } from '../../engine/types';
import { uid } from '../../state/store';
import { Button, CHIPS_WORK, DurationField, IconButton, Segmented, Toggle } from '../../components/ui';
import { useT } from '../../i18n';

export interface StepListProps {
  steps: CustomStep[];
  onChange: (steps: CustomStep[]) => void;
}

const MAX_STEPS = 40;

/** Custom-mode step builder. */
export function StepList({ steps, onChange }: StepListProps) {
  const { t } = useT();
  const update = (i: number, patch: Partial<CustomStep>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const duplicate = (i: number) => {
    const next = [...steps];
    next.splice(i + 1, 0, { ...steps[i], id: uid() });
    onChange(next);
  };
  const remove = (i: number) => onChange(steps.filter((_, j) => j !== i));
  const add = (kind: CustomStep['kind']) =>
    onChange([
      ...steps,
      { id: uid(), label: kind === 'rest' ? t('seg.rest') : '', kind, durationSec: kind === 'rest' ? 30 : 60 },
    ]);

  return (
    <div className="cfg-steps">
      {steps.length === 0 && <p className="cfg-steps__empty">{t('st.empty')}</p>}
      <ol className="cfg-steps__list">
        {steps.map((s, i) => {
          const untimed = s.durationSec === 0;
          return (
            <li key={s.id} className={`cfg-step is-${s.kind}`}>
              <div className="cfg-step__head">
                <span className="cfg-step__idx num" aria-hidden>
                  {i + 1}
                </span>
                <input
                  className="ui-input cfg-step__label"
                  value={s.label}
                  placeholder={s.kind === 'rest' ? t('seg.rest') : t('st.placeholder')}
                  aria-label={t('st.name', { n: i + 1 })}
                  maxLength={40}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
              <div className="cfg-step__body">
                <Segmented
                  size="sm"
                  label={t('st.type', { n: i + 1 })}
                  value={s.kind}
                  options={[
                    { value: 'work', label: t('seg.work') },
                    { value: 'rest', label: t('seg.rest') },
                  ]}
                  onChange={(kind) => update(i, { kind })}
                />
                <div className="cfg-step__time">
                  {untimed ? (
                    <span className="cfg-step__untimed">{t('st.tapNext')}</span>
                  ) : (
                    <DurationField
                      label={t('st.duration', { n: i + 1 })}
                      value={s.durationSec}
                      min={1}
                      chips={CHIPS_WORK}
                      onChange={(v) => update(i, { durationSec: v })}
                    />
                  )}
                </div>
              </div>
              <div className="cfg-step__foot">
                <label className="cfg-step__toggle">
                  <Toggle
                    label={t('st.timedAria', { n: i + 1 })}
                    checked={!untimed}
                    onChange={(on) => update(i, { durationSec: on ? 60 : 0 })}
                  />
                  <span>{untimed ? t('st.untimed') : t('st.timed')}</span>
                </label>
                <div className="cfg-step__tools">
                  <IconButton icon="chevronUp" label={t('st.up', { n: i + 1 })} size={18} disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton
                    icon="chevronDown"
                    label={t('st.down', { n: i + 1 })}
                    size={18}
                    disabled={i === steps.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton
                    icon="copy"
                    label={t('st.dup', { n: i + 1 })}
                    size={18}
                    disabled={steps.length >= MAX_STEPS}
                    onClick={() => duplicate(i)}
                  />
                  <IconButton icon="trash" label={t('st.del', { n: i + 1 })} size={18} onClick={() => remove(i)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="cfg-steps__add">
        <Button variant="secondary" icon="plus" disabled={steps.length >= MAX_STEPS} onClick={() => add('work')}>
          {t('st.addWork')}
        </Button>
        <Button variant="secondary" icon="plus" disabled={steps.length >= MAX_STEPS} onClick={() => add('rest')}>
          {t('st.addRest')}
        </Button>
      </div>
    </div>
  );
}
