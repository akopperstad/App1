import { MODES } from './modes';
import type { CustomStep, Mode, WorkoutConfig } from './types';

/**
 * Validate a WorkoutConfig that came from outside the type system
 * (localStorage presets / history / last-used configs, possibly written by an
 * older version of the app or corrupted). Returns a runnable config, or null
 * if the value is not a config at all (unknown mode, not an object).
 *
 * Valid configs come back equal to the input (same keys, same order); only
 * missing or malformed fields are replaced — with the mode's default, or
 * clamped into range.
 */
export function normalizeConfig(raw: unknown): WorkoutConfig | null {
  if (!isObj(raw) || typeof raw.mode !== 'string') return null;
  const info = MODES.find((m) => m.mode === (raw.mode as Mode));
  if (!info) return null;
  const defaults = info.defaults as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };

  /** Number field: default when missing / non-finite, then clamped to [min, MAX]. */
  const num = (key: string, min: number, int = false) => {
    const v = out[key];
    let n = typeof v === 'number' && Number.isFinite(v) ? v : (defaults[key] as number);
    if (int) n = Math.round(n);
    out[key] = Math.min(MAX, Math.max(min, n));
  };
  const strings = (key: string) => {
    const v = out[key];
    out[key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };

  switch (info.mode) {
    case 'amrap':
      num('durationSec', 1);
      num('sets', 1, true);
      num('restBetweenSetsSec', 0);
      break;
    case 'emom':
      num('intervalSec', 1);
      num('rounds', 1, true);
      strings('movements');
      break;
    case 'tabata':
    case 'interval':
      num('workSec', 1);
      num('restSec', 0);
      num('rounds', 1, true);
      num('sets', 1, true);
      num('restBetweenSetsSec', 0);
      strings('movements');
      break;
    case 'fortime':
      num('capSec', 0);
      num('targetRounds', 0, true);
      break;
    case 'countdown':
      num('durationSec', 1);
      break;
    case 'stopwatch':
      break;
    case 'deathby':
      num('intervalSec', 1);
      num('startReps', 0, true);
      num('increment', 0, true);
      num('maxRounds', 1, true);
      if (typeof out.movement !== 'string') out.movement = defaults.movement;
      break;
    case 'custom': {
      num('rounds', 1, true);
      num('restBetweenRoundsSec', 0);
      const steps: unknown[] = Array.isArray(raw.steps) ? raw.steps : [];
      out.steps = steps.flatMap((o: unknown, i: number): CustomStep[] => {
        if (!isObj(o)) return [];
        const d = o.durationSec;
        return [
          {
            ...o,
            id: typeof o.id === 'string' && o.id ? o.id : `s${i}`,
            label: typeof o.label === 'string' ? o.label : '',
            kind: o.kind === 'rest' ? 'rest' : 'work',
            // Negative stays negative (compile drops it); non-finite becomes "untimed".
            durationSec: typeof d === 'number' && Number.isFinite(d) ? Math.min(MAX, d) : 0,
          },
        ];
      });
      break;
    }
  }
  if (out.name !== undefined && typeof out.name !== 'string') delete out.name;
  out.mode = info.mode;
  return out as unknown as WorkoutConfig;
}

/** Upper bound for any stored number (seconds or counts): one week. */
const MAX = 7 * 24 * 3600;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
