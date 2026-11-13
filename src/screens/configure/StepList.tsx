import type { CustomStep } from '../../engine/types';
import { uid } from '../../state/store';
import { Button, CHIPS_WORK, DurationField, IconButton, Segmented, Toggle } from '../../components/ui';

export interface StepListProps {
  steps: CustomStep[];
  onChange: (steps: CustomStep[]) => void;
}

const MAX_STEPS = 40;

/** Custom-mode step builder. */
export function StepList({ steps, onChange }: StepListProps) {
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
      { id: uid(), label: kind === 'rest' ? 'Rest' : '', kind, durationSec: kind === 'rest' ? 30 : 60 },
    ]);

  return (
    <div className="cfg-steps">
      {steps.length === 0 && <p className="cfg-steps__empty">No steps yet. Add work and rest steps to build your sequence.</p>}
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
                  placeholder={s.kind === 'rest' ? 'Rest' : 'e.g. 20 Wall balls'}
                  aria-label={`Step ${i + 1} name`}
                  maxLength={40}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
              <div className="cfg-step__body">
                <Segmented
                  size="sm"
                  label={`Step ${i + 1} type`}
                  value={s.kind}
                  options={[
                    { value: 'work', label: 'Work' },
                    { value: 'rest', label: 'Rest' },
                  ]}
                  onChange={(kind) => update(i, { kind })}
                />
                <div className="cfg-step__time">
                  {untimed ? (
                    <span className="cfg-step__untimed">Tap Next</span>
                  ) : (
                    <DurationField
                      label={`Step ${i + 1} duration`}
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
                    label={`Step ${i + 1} timed`}
                    checked={!untimed}
                    onChange={(on) => update(i, { durationSec: on ? 60 : 0 })}
                  />
                  <span>{untimed ? 'Untimed' : 'Timed'}</span>
                </label>
                <div className="cfg-step__tools">
                  <IconButton icon="chevronUp" label={`Move step ${i + 1} up`} size={18} disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton
                    icon="chevronDown"
                    label={`Move step ${i + 1} down`}
                    size={18}
                    disabled={i === steps.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton
                    icon="copy"
                    label={`Duplicate step ${i + 1}`}
                    size={18}
                    disabled={steps.length >= MAX_STEPS}
                    onClick={() => duplicate(i)}
                  />
                  <IconButton icon="trash" label={`Delete step ${i + 1}`} size={18} onClick={() => remove(i)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="cfg-steps__add">
        <Button variant="secondary" icon="plus" disabled={steps.length >= MAX_STEPS} onClick={() => add('work')}>
          Work step
        </Button>
        <Button variant="secondary" icon="plus" disabled={steps.length >= MAX_STEPS} onClick={() => add('rest')}>
          Rest step
        </Button>
      </div>
    </div>
  );
}
