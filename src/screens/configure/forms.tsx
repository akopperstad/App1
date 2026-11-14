import { useRef } from 'react';
import type {
  AmrapConfig,
  CountdownConfig,
  CustomConfig,
  DeathByConfig,
  EmomConfig,
  ForTimeConfig,
  IntervalConfig,
  WorkoutConfig,
} from '../../engine/types';
import { mmss } from '../../lib/format';
import { CHIPS_REST, CHIPS_WORK, DurationField, Icon, Row, Section, Stepper, Toggle } from '../../components/ui';
import { useT } from '../../i18n';
import { MovementList } from './MovementList';
import { StepList } from './StepList';

type FormProps<C> = { config: C; onChange: (c: C) => void };

const CHIPS_AMRAP = [300, 420, 600, 720, 900, 1200, 1500, 1800, 2400];
const CHIPS_CAP = [300, 600, 720, 900, 1200, 1500, 1800, 2400, 3600];
const CHIPS_COUNTDOWN = [10, 20, 30, 60, 90, 120, 180, 300, 600, 900];
const CHIPS_EMOM = [30, 45, 60, 90, 120, 180];
const EMOM_LABELS: Record<number, string> = { 60: 'EMOM', 120: 'E2MOM', 180: 'E3MOM' };

/** Inline row of quick-pick chips (visible without opening the picker). */
function InlineChips({
  values,
  value,
  onPick,
  labels,
  label,
}: {
  values: number[];
  value: number;
  onPick: (v: number) => void;
  labels?: Record<number, string>;
  label: string;
}) {
  return (
    <div className="cfg-inline-chips" role="group" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={`ui-chip num${v === value ? ' is-active' : ''}`}
          aria-pressed={v === value}
          onClick={() => onPick(v)}
        >
          {labels?.[v] ? (
            <>
              <strong>{labels[v]}</strong>
              <small>{mmss(v)}</small>
            </>
          ) : (
            mmss(v)
          )}
        </button>
      ))}
    </div>
  );
}

function AmrapForm({ config: c, onChange }: FormProps<AmrapConfig>) {
  const { t } = useT();
  return (
    <Section title={t('f.workout')}>
      <Row label={t('f.duration')} hint={c.sets > 1 ? t('f.perBlock') : t('f.amrapHint')}>
        <DurationField label={t('f.amrapDuration')} value={c.durationSec} min={10} chips={CHIPS_AMRAP} onChange={(v) => onChange({ ...c, durationSec: v })} />
      </Row>
      <Row label={t('f.sets')} hint={t('f.setsHint')}>
        <Stepper label={t('f.sets')} value={c.sets} min={1} max={20} onChange={(v) => onChange({ ...c, sets: v })} />
      </Row>
      {c.sets > 1 && (
        <Row label={t('f.restBetweenSets')}>
          <DurationField
            label={t('f.restBetweenSets')}
            value={c.restBetweenSetsSec}
            zeroLabel={t('f.none')}
            chips={CHIPS_REST}
            onChange={(v) => onChange({ ...c, restBetweenSetsSec: v })}
          />
        </Row>
      )}
    </Section>
  );
}

function EmomForm({ config: c, onChange }: FormProps<EmomConfig>) {
  const { t } = useT();
  return (
    <>
      <Section title={t('f.workout')}>
        <Row label={t('f.every')} hint={t('f.everyHint')}>
          <DurationField
            label={t('f.intervalLength')}
            value={c.intervalSec}
            min={10}
            max={1200}
            chips={CHIPS_EMOM}
            chipLabels={EMOM_LABELS}
            onChange={(v) => onChange({ ...c, intervalSec: v })}
          />
        </Row>
        <div className="cfg-chip-row">
          <InlineChips label={t('f.intervalPresets')} values={CHIPS_EMOM} labels={EMOM_LABELS} value={c.intervalSec} onPick={(v) => onChange({ ...c, intervalSec: v })} />
        </div>
        <Row label={t('f.rounds')}>
          <Stepper label={t('f.rounds')} value={c.rounds} min={1} max={120} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
      </Section>
      <Section title={t('f.movements')}>
        <MovementList unit="interval" value={c.movements} onChange={(movements) => onChange({ ...c, movements })} />
      </Section>
    </>
  );
}

function IntervalForm({ config: c, onChange }: FormProps<IntervalConfig>) {
  const { t } = useT();
  return (
    <>
      <Section title={t('f.intervals')}>
        <Row label={t('seg.work')}>
          <DurationField label={t('seg.work')} value={c.workSec} min={1} chips={CHIPS_WORK} onChange={(v) => onChange({ ...c, workSec: v })} />
        </Row>
        <Row label={t('seg.rest')}>
          <DurationField label={t('seg.rest')} value={c.restSec} zeroLabel={t('f.none')} chips={CHIPS_REST} onChange={(v) => onChange({ ...c, restSec: v })} />
        </Row>
        <Row label={t('f.rounds')}>
          <Stepper label={t('f.rounds')} value={c.rounds} min={1} max={99} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
      </Section>
      <Section title={t('f.sets')}>
        <Row label={t('f.sets')} hint={t('f.repeatBlock')}>
          <Stepper label={t('f.sets')} value={c.sets} min={1} max={20} onChange={(v) => onChange({ ...c, sets: v })} />
        </Row>
        {c.sets > 1 && (
          <Row label={t('f.restBetweenSets')}>
            <DurationField
              label={t('f.restBetweenSets')}
              value={c.restBetweenSetsSec}
              zeroLabel={t('f.none')}
              chips={CHIPS_REST}
              onChange={(v) => onChange({ ...c, restBetweenSetsSec: v })}
            />
          </Row>
        )}
      </Section>
      <Section title={t('f.movements')}>
        <MovementList unit="round" allowRest={false} value={c.movements} onChange={(movements) => onChange({ ...c, movements })} />
      </Section>
    </>
  );
}

function ForTimeForm({ config: c, onChange }: FormProps<ForTimeConfig>) {
  const { t } = useT();
  const lastCap = useRef(c.capSec || 20 * 60);
  if (c.capSec > 0) lastCap.current = c.capSec;
  return (
    <Section title={t('f.workout')} footer={t('f.forTimeFooter')}>
      <Row label={t('f.timeCap')} hint={c.capSec > 0 ? t('f.capOn') : t('f.capOff')}>
        <Toggle label={t('f.timeCap')} checked={c.capSec > 0} onChange={(on) => onChange({ ...c, capSec: on ? lastCap.current : 0 })} />
      </Row>
      {c.capSec > 0 && (
        <Row label={t('f.cap')}>
          <DurationField label={t('f.timeCap')} value={c.capSec} min={30} chips={CHIPS_CAP} onChange={(v) => onChange({ ...c, capSec: v })} />
        </Row>
      )}
      <Row label={t('f.targetRounds')} hint={t('f.targetHint')}>
        <Stepper
          label={t('f.targetRounds')}
          value={c.targetRounds}
          min={0}
          max={100}
          format={(v) => (v === 0 ? t('common.off') : String(v))}
          onChange={(v) => onChange({ ...c, targetRounds: v })}
        />
      </Row>
    </Section>
  );
}

function CountdownForm({ config: c, onChange }: FormProps<CountdownConfig>) {
  const { t } = useT();
  return (
    <Section title={t('f.timer')}>
      <Row label={t('f.duration')}>
        <DurationField label={t('f.duration')} value={c.durationSec} min={1} chips={CHIPS_COUNTDOWN} onChange={(v) => onChange({ ...c, durationSec: v })} />
      </Row>
      <div className="cfg-chip-row">
        <InlineChips label={t('f.durationPresets')} values={[30, 60, 120, 180, 300, 600]} value={c.durationSec} onPick={(v) => onChange({ ...c, durationSec: v })} />
      </div>
    </Section>
  );
}

function StopwatchInfo() {
  const { t } = useT();
  return (
    <Section title={t('f.how')}>
      <div className="cfg-info">
        <InfoLine icon="play" text={t('f.sw1')} />
        <InfoLine icon="flag" text={t('f.sw2')} />
        <InfoLine icon="pause" text={t('f.sw3')} />
      </div>
    </Section>
  );
}

function InfoLine({ icon, text }: { icon: 'play' | 'flag' | 'pause' | 'bolt'; text: string }) {
  return (
    <div className="cfg-info__line">
      <span className="cfg-info__icon">
        <Icon name={icon} size={16} />
      </span>
      <span>{text}</span>
    </div>
  );
}

function DeathByForm({ config: c, onChange }: FormProps<DeathByConfig>) {
  const { t } = useT();
  const repsAt = (r: number) => c.startReps + (r - 1) * c.increment;
  return (
    <>
      <Section title={t('f.workout')}>
        <Row label={t('f.movement')} hint={t('f.movementHint')} htmlFor="deathby-move" stacked>
          <input
            id="deathby-move"
            className="ui-input"
            value={c.movement}
            placeholder={t('f.movementPlaceholder')}
            maxLength={40}
            onChange={(e) => onChange({ ...c, movement: e.target.value })}
          />
        </Row>
      </Section>
      <Section title={t('f.progression')}>
        <Row label={t('f.every')}>
          <DurationField label={t('f.interval')} value={c.intervalSec} min={10} max={600} chips={[30, 45, 60, 90, 120, 180]} onChange={(v) => onChange({ ...c, intervalSec: v })} />
        </Row>
        <Row label={t('f.startReps')}>
          <Stepper label={t('f.startReps')} value={c.startReps} min={1} max={100} onChange={(v) => onChange({ ...c, startReps: v })} />
        </Row>
        <Row label={t('f.addEach')}>
          <Stepper label={t('f.addEachAria')} value={c.increment} min={1} max={20} onChange={(v) => onChange({ ...c, increment: v })} />
        </Row>
        <Row label={t('f.maxRounds')} hint={t('f.maxHint')}>
          <Stepper label={t('f.maxRounds')} value={c.maxRounds} min={1} max={100} onChange={(v) => onChange({ ...c, maxRounds: v })} />
        </Row>
      </Section>
      <div className="cfg-ladder" aria-label={t('f.ladder')}>
        {[1, 2, 3, 5, 10].filter((r) => r <= c.maxRounds).map((r) => (
          <div key={r} className="cfg-ladder__step">
            <span className="cfg-ladder__r">{t('f.roundShort', { n: r })}</span>
            <span className="cfg-ladder__n num">{repsAt(r)}</span>
          </div>
        ))}
        {c.maxRounds > 10 && (
          <div className="cfg-ladder__step is-max">
            <span className="cfg-ladder__r">{t('f.roundShort', { n: c.maxRounds })}</span>
            <span className="cfg-ladder__n num">{repsAt(c.maxRounds)}</span>
          </div>
        )}
      </div>
    </>
  );
}

function CustomForm({ config: c, onChange }: FormProps<CustomConfig>) {
  const { t } = useT();
  return (
    <>
      <Section title={t('f.steps', { n: c.steps.length })} plain>
        <StepList steps={c.steps} onChange={(steps) => onChange({ ...c, steps })} />
      </Section>
      <Section title={t('f.repeat')}>
        <Row label={t('f.rounds')} hint={t('f.repeatHint')}>
          <Stepper label={t('f.rounds')} value={c.rounds} min={1} max={50} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
        {c.rounds > 1 && (
          <Row label={t('f.restBetweenRounds')}>
            <DurationField
              label={t('f.restBetweenRounds')}
              value={c.restBetweenRoundsSec}
              zeroLabel={t('f.none')}
              chips={CHIPS_REST}
              onChange={(v) => onChange({ ...c, restBetweenRoundsSec: v })}
            />
          </Row>
        )}
      </Section>
    </>
  );
}

/** Mode-specific form. */
export function ModeForm({ config, onChange }: FormProps<WorkoutConfig>) {
  switch (config.mode) {
    case 'amrap':
      return <AmrapForm config={config} onChange={onChange} />;
    case 'emom':
      return <EmomForm config={config} onChange={onChange} />;
    case 'tabata':
    case 'interval':
      return <IntervalForm config={config} onChange={onChange} />;
    case 'fortime':
      return <ForTimeForm config={config} onChange={onChange} />;
    case 'countdown':
      return <CountdownForm config={config} onChange={onChange} />;
    case 'stopwatch':
      return <StopwatchInfo />;
    case 'deathby':
      return <DeathByForm config={config} onChange={onChange} />;
    case 'custom':
      return <CustomForm config={config} onChange={onChange} />;
  }
}
