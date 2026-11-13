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
  return (
    <Section title="Workout">
      <Row label="Duration" hint={c.sets > 1 ? 'Per AMRAP block' : 'Rounds as many as you can'}>
        <DurationField label="AMRAP duration" value={c.durationSec} min={10} chips={CHIPS_AMRAP} onChange={(v) => onChange({ ...c, durationSec: v })} />
      </Row>
      <Row label="Sets" hint="Back-to-back AMRAP blocks">
        <Stepper label="Sets" value={c.sets} min={1} max={20} onChange={(v) => onChange({ ...c, sets: v })} />
      </Row>
      {c.sets > 1 && (
        <Row label="Rest between sets">
          <DurationField
            label="Rest between sets"
            value={c.restBetweenSetsSec}
            zeroLabel="None"
            chips={CHIPS_REST}
            onChange={(v) => onChange({ ...c, restBetweenSetsSec: v })}
          />
        </Row>
      )}
    </Section>
  );
}

function EmomForm({ config: c, onChange }: FormProps<EmomConfig>) {
  return (
    <>
      <Section title="Workout">
        <Row label="Every" hint="Length of each interval">
          <DurationField
            label="Interval length"
            value={c.intervalSec}
            min={10}
            max={1200}
            chips={CHIPS_EMOM}
            chipLabels={EMOM_LABELS}
            onChange={(v) => onChange({ ...c, intervalSec: v })}
          />
        </Row>
        <div className="cfg-chip-row">
          <InlineChips label="Interval presets" values={CHIPS_EMOM} labels={EMOM_LABELS} value={c.intervalSec} onPick={(v) => onChange({ ...c, intervalSec: v })} />
        </div>
        <Row label="Rounds">
          <Stepper label="Rounds" value={c.rounds} min={1} max={120} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
      </Section>
      <Section title="Movements">
        <MovementList unit="interval" value={c.movements} onChange={(movements) => onChange({ ...c, movements })} />
      </Section>
    </>
  );
}

function IntervalForm({ config: c, onChange }: FormProps<IntervalConfig>) {
  return (
    <>
      <Section title="Intervals">
        <Row label="Work">
          <DurationField label="Work" value={c.workSec} min={1} chips={CHIPS_WORK} onChange={(v) => onChange({ ...c, workSec: v })} />
        </Row>
        <Row label="Rest">
          <DurationField label="Rest" value={c.restSec} zeroLabel="None" chips={CHIPS_REST} onChange={(v) => onChange({ ...c, restSec: v })} />
        </Row>
        <Row label="Rounds">
          <Stepper label="Rounds" value={c.rounds} min={1} max={99} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
      </Section>
      <Section title="Sets">
        <Row label="Sets" hint="Repeat the whole block">
          <Stepper label="Sets" value={c.sets} min={1} max={20} onChange={(v) => onChange({ ...c, sets: v })} />
        </Row>
        {c.sets > 1 && (
          <Row label="Rest between sets">
            <DurationField
              label="Rest between sets"
              value={c.restBetweenSetsSec}
              zeroLabel="None"
              chips={CHIPS_REST}
              onChange={(v) => onChange({ ...c, restBetweenSetsSec: v })}
            />
          </Row>
        )}
      </Section>
      <Section title="Movements">
        <MovementList unit="work round" allowRest={false} value={c.movements} onChange={(movements) => onChange({ ...c, movements })} />
      </Section>
    </>
  );
}

function ForTimeForm({ config: c, onChange }: FormProps<ForTimeConfig>) {
  const lastCap = useRef(c.capSec || 20 * 60);
  if (c.capSec > 0) lastCap.current = c.capSec;
  return (
    <Section title="Workout" footer="The clock counts up. Tap Finish when you're done — or let the cap end it.">
      <Row label="Time cap" hint={c.capSec > 0 ? 'Workout ends at the cap' : 'No cap — runs until you finish'}>
        <Toggle label="Time cap" checked={c.capSec > 0} onChange={(on) => onChange({ ...c, capSec: on ? lastCap.current : 0 })} />
      </Row>
      {c.capSec > 0 && (
        <Row label="Cap">
          <DurationField label="Time cap" value={c.capSec} min={30} chips={CHIPS_CAP} onChange={(v) => onChange({ ...c, capSec: v })} />
        </Row>
      )}
      <Row label="Target rounds" hint="Optional — for the round counter">
        <Stepper
          label="Target rounds"
          value={c.targetRounds}
          min={0}
          max={100}
          format={(v) => (v === 0 ? 'Off' : String(v))}
          onChange={(v) => onChange({ ...c, targetRounds: v })}
        />
      </Row>
    </Section>
  );
}

function CountdownForm({ config: c, onChange }: FormProps<CountdownConfig>) {
  return (
    <Section title="Timer">
      <Row label="Duration">
        <DurationField label="Duration" value={c.durationSec} min={1} chips={CHIPS_COUNTDOWN} onChange={(v) => onChange({ ...c, durationSec: v })} />
      </Row>
      <div className="cfg-chip-row">
        <InlineChips label="Duration presets" values={[30, 60, 120, 180, 300, 600]} value={c.durationSec} onPick={(v) => onChange({ ...c, durationSec: v })} />
      </div>
    </Section>
  );
}

function StopwatchInfo() {
  return (
    <Section title="How it works">
      <div className="cfg-info">
        <InfoLine icon="play" text="Counts up from zero with no limit." />
        <InfoLine icon="flag" text="Tap Lap to record splits — each lap and its split time are saved to History." />
        <InfoLine icon="pause" text="Pause and resume any time. Tap Finish to stop." />
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
  const repsAt = (r: number) => c.startReps + (r - 1) * c.increment;
  return (
    <>
      <Section title="Movement">
        <Row label="Movement" htmlFor="deathby-move" stacked>
          <input
            id="deathby-move"
            className="ui-input"
            value={c.movement}
            placeholder="e.g. Burpees"
            maxLength={40}
            onChange={(e) => onChange({ ...c, movement: e.target.value })}
          />
        </Row>
      </Section>
      <Section title="Progression">
        <Row label="Every">
          <DurationField label="Interval" value={c.intervalSec} min={10} max={600} chips={[30, 45, 60, 90, 120, 180]} onChange={(v) => onChange({ ...c, intervalSec: v })} />
        </Row>
        <Row label="Start reps">
          <Stepper label="Start reps" value={c.startReps} min={1} max={100} onChange={(v) => onChange({ ...c, startReps: v })} />
        </Row>
        <Row label="Add each round">
          <Stepper label="Reps added each round" value={c.increment} min={1} max={20} onChange={(v) => onChange({ ...c, increment: v })} />
        </Row>
        <Row label="Max rounds" hint="Stops here if you haven't failed">
          <Stepper label="Max rounds" value={c.maxRounds} min={1} max={100} onChange={(v) => onChange({ ...c, maxRounds: v })} />
        </Row>
      </Section>
      <div className="cfg-ladder" aria-label="Rep ladder preview">
        {[1, 2, 3, 5, 10].filter((r) => r <= c.maxRounds).map((r) => (
          <div key={r} className="cfg-ladder__step">
            <span className="cfg-ladder__r">R{r}</span>
            <span className="cfg-ladder__n num">{repsAt(r)}</span>
          </div>
        ))}
        {c.maxRounds > 10 && (
          <div className="cfg-ladder__step is-max">
            <span className="cfg-ladder__r">R{c.maxRounds}</span>
            <span className="cfg-ladder__n num">{repsAt(c.maxRounds)}</span>
          </div>
        )}
      </div>
    </>
  );
}

function CustomForm({ config: c, onChange }: FormProps<CustomConfig>) {
  return (
    <>
      <Section title={`Steps · ${c.steps.length}`} plain>
        <StepList steps={c.steps} onChange={(steps) => onChange({ ...c, steps })} />
      </Section>
      <Section title="Repeat">
        <Row label="Rounds" hint="Run the whole sequence">
          <Stepper label="Rounds" value={c.rounds} min={1} max={50} onChange={(v) => onChange({ ...c, rounds: v })} />
        </Row>
        {c.rounds > 1 && (
          <Row label="Rest between rounds">
            <DurationField
              label="Rest between rounds"
              value={c.restBetweenRoundsSec}
              zeroLabel="None"
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
