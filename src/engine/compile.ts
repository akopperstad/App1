import type { Segment, WorkoutConfig } from './types';

const S = 1000;

function rotate(list: string[], i: number): string | undefined {
  const clean = list.map((m) => m.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  return clean[i % clean.length];
}

/**
 * Compile a workout configuration into a flat list of segments.
 * @param prepSec length of the "get ready" lead-in (0 to disable).
 */
export function compile(config: WorkoutConfig, prepSec: number): Segment[] {
  const out: Segment[] = [];
  if (prepSec > 0) {
    out.push({ kind: 'prep', label: 'Get ready', durationMs: prepSec * S, direction: 'down' });
  }

  switch (config.mode) {
    case 'amrap': {
      const sets = Math.max(1, config.sets);
      for (let s = 1; s <= sets; s++) {
        out.push({
          kind: 'work',
          label: 'AMRAP',
          durationMs: config.durationSec * S,
          direction: 'down',
          set: s,
          totalSets: sets,
        });
        if (s < sets && config.restBetweenSetsSec > 0) {
          out.push({
            kind: 'rest',
            label: 'Rest',
            detail: `Next: AMRAP ${s + 1} of ${sets}`,
            durationMs: config.restBetweenSetsSec * S,
            direction: 'down',
            set: s,
            totalSets: sets,
          });
        }
      }
      break;
    }

    case 'emom': {
      const rounds = Math.max(1, config.rounds);
      for (let r = 1; r <= rounds; r++) {
        const movement = rotate(config.movements, r - 1);
        const isRest = movement?.toLowerCase() === 'rest';
        out.push({
          kind: isRest ? 'rest' : 'work',
          label: isRest ? 'Rest' : config.intervalSec === 60 ? 'EMOM' : `E${formatEvery(config.intervalSec)}`,
          detail: isRest ? undefined : movement,
          durationMs: config.intervalSec * S,
          direction: 'down',
          round: r,
          totalRounds: rounds,
        });
      }
      break;
    }

    case 'tabata':
    case 'interval': {
      const rounds = Math.max(1, config.rounds);
      const sets = Math.max(1, config.sets);
      let workIdx = 0;
      for (let s = 1; s <= sets; s++) {
        for (let r = 1; r <= rounds; r++) {
          out.push({
            kind: 'work',
            label: 'Work',
            detail: rotate(config.movements, workIdx++),
            durationMs: config.workSec * S,
            direction: 'down',
            round: r,
            totalRounds: rounds,
            set: s,
            totalSets: sets,
          });
          const lastRoundOfSet = r === rounds;
          const lastOverall = lastRoundOfSet && s === sets;
          if (lastOverall) break;
          if (lastRoundOfSet) {
            if (config.restBetweenSetsSec > 0) {
              out.push({
                kind: 'rest',
                label: 'Set rest',
                detail: `Next: set ${s + 1} of ${sets}`,
                durationMs: config.restBetweenSetsSec * S,
                direction: 'down',
                round: r,
                totalRounds: rounds,
                set: s,
                totalSets: sets,
              });
            } else if (config.restSec > 0) {
              out.push(restSeg(config.restSec, r, rounds, s, sets));
            }
          } else if (config.restSec > 0) {
            out.push(restSeg(config.restSec, r, rounds, s, sets));
          }
        }
      }
      break;
    }

    case 'fortime': {
      out.push({
        kind: 'work',
        label: 'For time',
        detail: config.capSec > 0 ? `Cap ${formatClock(config.capSec)}` : undefined,
        durationMs: config.capSec > 0 ? config.capSec * S : null,
        direction: 'up',
      });
      break;
    }

    case 'countdown': {
      out.push({
        kind: 'work',
        label: 'Countdown',
        durationMs: config.durationSec * S,
        direction: 'down',
      });
      break;
    }

    case 'stopwatch': {
      out.push({ kind: 'work', label: 'Stopwatch', durationMs: null, direction: 'up' });
      break;
    }

    case 'deathby': {
      const max = Math.max(1, config.maxRounds);
      for (let r = 1; r <= max; r++) {
        const reps = config.startReps + (r - 1) * config.increment;
        out.push({
          kind: 'work',
          label: 'Death by',
          detail: `${reps} ${config.movement || 'reps'}`.trim(),
          durationMs: config.intervalSec * S,
          direction: 'down',
          round: r,
          totalRounds: max,
        });
      }
      break;
    }

    case 'custom': {
      const rounds = Math.max(1, config.rounds);
      const steps = config.steps.filter((st) => st.durationSec >= 0);
      for (let r = 1; r <= rounds; r++) {
        steps.forEach((st) => {
          const timed = st.durationSec > 0;
          out.push({
            kind: st.kind,
            label: st.label.trim() || (st.kind === 'rest' ? 'Rest' : 'Work'),
            durationMs: timed ? st.durationSec * S : null,
            direction: timed ? 'down' : 'up',
            round: r,
            totalRounds: rounds,
          });
        });
        if (r < rounds && config.restBetweenRoundsSec > 0) {
          out.push({
            kind: 'rest',
            label: 'Round rest',
            detail: `Next: round ${r + 1} of ${rounds}`,
            durationMs: config.restBetweenRoundsSec * S,
            direction: 'down',
            round: r,
            totalRounds: rounds,
          });
        }
      }
      break;
    }
  }

  // Guarantee at least one non-prep segment so the engine always has work to do.
  if (!out.some((s) => s.kind !== 'prep')) {
    out.push({ kind: 'work', label: 'Work', durationMs: null, direction: 'up' });
  }
  return out;
}

function restSeg(sec: number, r: number, rounds: number, s: number, sets: number): Segment {
  return {
    kind: 'rest',
    label: 'Rest',
    durationMs: sec * S,
    direction: 'down',
    round: r,
    totalRounds: rounds,
    set: s,
    totalSets: sets,
  };
}

function formatEvery(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60}MOM`;
  return `${sec}s`;
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Sum of timed (non-prep) segments, or null if any is open-ended. */
export function plannedWorkMs(segments: Segment[]): number | null {
  let sum = 0;
  for (const s of segments) {
    if (s.kind === 'prep') continue;
    if (s.durationMs === null) return null;
    sum += s.durationMs;
  }
  return sum;
}
