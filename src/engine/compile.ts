import { EN, isRestWord, type Translator } from '../i18n/core';
import type { Segment, WorkoutConfig } from './types';

const S = 1000;

/**
 * Seconds → ms, robust to malformed input (configs can come from old or
 * corrupted storage): anything non-finite counts as 0.
 */
function ms(sec: unknown): number {
  return typeof sec === 'number' && Number.isFinite(sec) ? Math.max(0, sec) * S : 0;
}

/** Count (rounds, sets) robust to malformed input: at least 1. */
function count(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}

function rotate(list: string[] | undefined, i: number): string | undefined {
  if (!Array.isArray(list)) return undefined;
  const clean = list.filter((m) => typeof m === 'string').map((m) => m.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  return clean[i % clean.length];
}

/**
 * Compile a workout configuration into a flat list of segments.
 * @param prepSec length of the "get ready" lead-in (0 to disable).
 * @param tr      translator for built-in labels / details (default English).
 *                The language is fixed for the whole workout, so callers pass
 *                the user's translator once when the run starts. Every segment
 *                also carries a language-independent `type`.
 */
export function compile(config: WorkoutConfig, prepSec: number, tr: Translator = EN): Segment[] {
  const { t } = tr;
  const out: Segment[] = [];
  if (ms(prepSec) > 0) {
    out.push({ kind: 'prep', type: 'prep', label: t('seg.getReady'), durationMs: ms(prepSec), direction: 'down' });
  }

  switch (config.mode) {
    case 'amrap': {
      const sets = count(config.sets);
      for (let s = 1; s <= sets; s++) {
        out.push({
          kind: 'work',
          type: 'amrap',
          label: 'AMRAP',
          durationMs: ms(config.durationSec),
          direction: 'down',
          set: s,
          totalSets: sets,
        });
        if (s < sets && ms(config.restBetweenSetsSec) > 0) {
          out.push({
            kind: 'rest',
            type: 'amrapRest',
            label: t('seg.rest'),
            detail: t('seg.nextAmrap', { n: s + 1, total: sets }),
            durationMs: ms(config.restBetweenSetsSec),
            direction: 'down',
            set: s,
            totalSets: sets,
          });
        }
      }
      break;
    }

    case 'emom': {
      const rounds = count(config.rounds);
      for (let r = 1; r <= rounds; r++) {
        const movement = rotate(config.movements, r - 1);
        const isRest = isRestWord(movement);
        out.push({
          kind: isRest ? 'rest' : 'work',
          type: isRest ? 'rest' : 'emom',
          label: isRest ? t('seg.rest') : config.intervalSec === 60 ? 'EMOM' : `E${formatEvery(config.intervalSec)}`,
          detail: isRest ? undefined : movement,
          durationMs: ms(config.intervalSec),
          direction: 'down',
          round: r,
          totalRounds: rounds,
        });
      }
      break;
    }

    case 'tabata':
    case 'interval': {
      const rounds = count(config.rounds);
      const sets = count(config.sets);
      let workIdx = 0;
      for (let s = 1; s <= sets; s++) {
        for (let r = 1; r <= rounds; r++) {
          out.push({
            kind: 'work',
            type: 'work',
            label: t('seg.work'),
            detail: rotate(config.movements, workIdx++),
            durationMs: ms(config.workSec),
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
            if (ms(config.restBetweenSetsSec) > 0) {
              out.push({
                kind: 'rest',
                type: 'setRest',
                label: t('seg.setRest'),
                detail: t('seg.nextSet', { n: s + 1, total: sets }),
                durationMs: ms(config.restBetweenSetsSec),
                direction: 'down',
                round: r,
                totalRounds: rounds,
                set: s,
                totalSets: sets,
              });
            } else if (ms(config.restSec) > 0) {
              out.push(restSeg(t('seg.rest'), ms(config.restSec), r, rounds, s, sets));
            }
          } else if (ms(config.restSec) > 0) {
            out.push(restSeg(t('seg.rest'), ms(config.restSec), r, rounds, s, sets));
          }
        }
      }
      break;
    }

    case 'fortime': {
      out.push({
        kind: 'work',
        type: 'fortime',
        label: t('seg.forTime'),
        detail: ms(config.capSec) > 0 ? t('seg.cap', { time: formatClock(config.capSec) }) : undefined,
        durationMs: ms(config.capSec) > 0 ? ms(config.capSec) : null,
        direction: 'up',
      });
      break;
    }

    case 'countdown': {
      out.push({
        kind: 'work',
        type: 'countdown',
        label: t('seg.countdown'),
        durationMs: ms(config.durationSec),
        direction: 'down',
      });
      break;
    }

    case 'stopwatch': {
      out.push({ kind: 'work', type: 'stopwatch', label: t('seg.stopwatch'), durationMs: null, direction: 'up' });
      break;
    }

    case 'deathby': {
      const max = count(config.maxRounds);
      for (let r = 1; r <= max; r++) {
        const reps = (Number(config.startReps) || 0) + (r - 1) * (Number(config.increment) || 0);
        out.push({
          kind: 'work',
          type: 'deathby',
          label: t('seg.deathBy'),
          detail: `${reps} ${(typeof config.movement === 'string' && config.movement.trim()) || t('seg.reps')}`.trim(),
          durationMs: ms(config.intervalSec),
          direction: 'down',
          round: r,
          totalRounds: max,
        });
      }
      break;
    }

    case 'custom': {
      const rounds = count(config.rounds);
      const steps = (Array.isArray(config.steps) ? config.steps : []).filter(
        (st) => !!st && typeof st === 'object' && !(st.durationSec < 0),
      );
      // No steps → no rounds (a bare round-rest sequence would be nonsense);
      // the fallback open-ended segment below takes over.
      if (steps.length === 0) break;
      for (let r = 1; r <= rounds; r++) {
        steps.forEach((st) => {
          const timed = ms(st.durationSec) > 0;
          const kind = st.kind === 'rest' ? 'rest' : 'work';
          const own = typeof st.label === 'string' ? st.label.trim() : '';
          // A rest step named just "Rest" (in any language) shows as the built-in, translated rest.
          const plainRest = kind === 'rest' && (!own || isRestWord(own));
          out.push({
            kind,
            type: plainRest ? 'rest' : 'step',
            label: plainRest ? t('seg.rest') : own || t('seg.work'),
            durationMs: timed ? ms(st.durationSec) : null,
            direction: timed ? 'down' : 'up',
            round: r,
            totalRounds: rounds,
          });
        });
        if (r < rounds && ms(config.restBetweenRoundsSec) > 0) {
          out.push({
            kind: 'rest',
            type: 'roundRest',
            label: t('seg.roundRest'),
            detail: t('seg.nextRound', { n: r + 1, total: rounds }),
            durationMs: ms(config.restBetweenRoundsSec),
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
    out.push({ kind: 'work', type: 'open', label: t('seg.work'), durationMs: null, direction: 'up' });
  }
  return out;
}

function restSeg(label: string, durationMs: number, r: number, rounds: number, s: number, sets: number): Segment {
  return {
    kind: 'rest',
    type: 'rest',
    label,
    durationMs,
    direction: 'down',
    round: r,
    totalRounds: rounds,
    set: s,
    totalSets: sets,
  };
}

function formatEvery(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60}MOM`;
  return formatClock(sec); // "E1:30", "E0:45" — reads cleanly when uppercased
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
