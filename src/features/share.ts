/**
 * Share workouts as compact, URL-safe codes.
 *
 *   code = "1." + base64url(JSON)        (version 1)
 *
 * The JSON is a minimal form of the WorkoutConfig: short keys, fields equal to
 * the mode's defaults dropped (normalizeConfig refills them), custom steps as
 * [label, kind, seconds] tuples. Decoding never trusts the payload: only known
 * keys are read and the result goes through normalizeConfig plus size limits.
 */
import { MODES } from '../engine/modes';
import { normalizeConfig } from '../engine/normalize';
import type { CustomStep, Mode, WorkoutConfig } from '../engine/types';

export const SHARE_VERSION = 1;
const PREFIX = `${SHARE_VERSION}.`;
/** Hash parameter: https://host/#w=<code> */
export const SHARE_PARAM = 'w';

/** Longest code we accept (a 100-step custom workout is ~4 kB). */
const MAX_CODE = 12_000;
const MAX_NAME = 80;
const MAX_LABEL = 60;
const MAX_ITEMS = 100;

/** Long field name → short key. Order is irrelevant; keys must be unique. */
const SHORT: Record<string, string> = {
  name: 'n',
  durationSec: 'd',
  sets: 's',
  restBetweenSetsSec: 'b',
  intervalSec: 'i',
  rounds: 'r',
  movements: 'v',
  workSec: 'w',
  restSec: 't',
  capSec: 'c',
  targetRounds: 'g',
  startReps: 'p',
  increment: 'x',
  maxRounds: 'm',
  movement: 'o',
  steps: 'q',
  restBetweenRoundsSec: 'z',
};
const LONG: Record<string, string> = Object.fromEntries(Object.entries(SHORT).map(([k, v]) => [v, k]));

const MODE_CODES: Record<Mode, string> = {
  amrap: 'a',
  emom: 'e',
  tabata: 't',
  interval: 'i',
  fortime: 'f',
  countdown: 'c',
  stopwatch: 's',
  deathby: 'd',
  custom: 'x',
};
const CODE_MODES = Object.fromEntries(Object.entries(MODE_CODES).map(([m, c]) => [c, m as Mode])) as Record<string, Mode>;

type StepTuple = [label: string, kind: 0 | 1, sec: number];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ------------------------------------------------------------------ base64url (UTF-8 safe)

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(b64)) return null;
  try {
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ encode / decode

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Encode a config into a share code (e.g. "1.eyJrIjoiYSJ9"). */
export function encodeWorkout(config: WorkoutConfig): string {
  const defaults = MODES.find((m) => m.mode === config.mode)?.defaults as unknown as Record<string, unknown> | undefined;
  const src = config as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { k: MODE_CODES[config.mode] };
  for (const [long, short] of Object.entries(SHORT)) {
    if (!(long in src) || src[long] === undefined) continue;
    let v = src[long];
    if (long === 'name') {
      if (typeof v !== 'string' || !v.trim()) continue;
      out[short] = v.trim().slice(0, MAX_NAME);
      continue;
    }
    if (long === 'steps') {
      // Always included for custom (a missing list would decode as empty).
      out[short] = (Array.isArray(v) ? (v as CustomStep[]) : []).map(
        (s): StepTuple => [s.label ?? '', s.kind === 'rest' ? 1 : 0, s.durationSec],
      );
      continue;
    }
    if (defaults && long in defaults && same(v, defaults[long])) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[short] = v;
  }
  return PREFIX + toBase64Url(JSON.stringify(out));
}

/** Decode a share code. Returns a validated config, or null for anything malformed. */
export function decodeWorkout(code: unknown): WorkoutConfig | null {
  if (typeof code !== 'string') return null;
  const c = code.trim();
  if (!c.startsWith(PREFIX) || c.length > MAX_CODE) return null;
  const json = fromBase64Url(c.slice(PREFIX.length));
  if (json === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(data) || typeof data.k !== 'string') return null;
  const mode = Object.prototype.hasOwnProperty.call(CODE_MODES, data.k) ? CODE_MODES[data.k] : undefined;
  if (!mode) return null;

  const raw: Record<string, unknown> = { mode };
  for (const [short, long] of Object.entries(LONG)) {
    if (!Object.prototype.hasOwnProperty.call(data, short)) continue;
    raw[long] = data[short];
  }
  if (typeof raw.name === 'string') {
    const n = raw.name.trim().slice(0, MAX_NAME);
    if (n) raw.name = n;
    else delete raw.name;
  } else delete raw.name;
  if (Array.isArray(raw.movements)) {
    raw.movements = raw.movements
      .slice(0, MAX_ITEMS)
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.slice(0, MAX_LABEL));
  }
  if (typeof raw.movement === 'string') raw.movement = raw.movement.slice(0, MAX_LABEL);
  if (mode === 'custom') {
    const tuples = Array.isArray(raw.steps) ? raw.steps.slice(0, MAX_ITEMS) : [];
    raw.steps = tuples.flatMap((t: unknown, i: number): CustomStep[] => {
      if (!Array.isArray(t)) return [];
      const [label, kind, sec] = t as unknown[];
      return [
        {
          id: `s${i + 1}`,
          label: typeof label === 'string' ? label.slice(0, MAX_LABEL) : '',
          kind: kind === 1 ? 'rest' : 'work',
          durationSec: typeof sec === 'number' && Number.isFinite(sec) ? Math.max(0, sec) : 0,
        },
      ];
    });
    if ((raw.steps as CustomStep[]).length === 0) return null;
  } else {
    delete raw.steps;
  }
  const config = normalizeConfig(raw);
  return config && config.mode === mode ? config : null;
}

// ------------------------------------------------------------------ links

/**
 * Public origin for share links. Web builds use the page's own address;
 * native builds (capacitor://localhost, https://localhost) need the real
 * public host, configurable with VITE_SHARE_ORIGIN at build time.
 */
export function shareBase(
  loc: { protocol: string; hostname: string; origin: string; pathname: string; port?: string } = location,
  env: string | undefined = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SHARE_ORIGIN,
): string {
  const isPublicWeb =
    (loc.protocol === 'https:' || loc.protocol === 'http:') && loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1';
  if (isPublicWeb) return `${loc.origin}${loc.pathname}`;
  if (env) return env.endsWith('/') ? env : `${env}/`;
  // Native app built without VITE_SHARE_ORIGIN (capacitor://localhost on iOS,
  // https://localhost on Android): a localhost link would be useless to the
  // recipient, so fall back to the app's own scheme (opens Pulse if installed).
  const nativeShell = loc.protocol === 'capacitor:' || (loc.protocol === 'https:' && loc.hostname === 'localhost' && !loc.port);
  if (nativeShell) return 'pulsetimer://import';
  return `${loc.origin}${loc.pathname}`;
}

export function shareUrl(config: WorkoutConfig, base = shareBase()): string {
  return `${base}#${SHARE_PARAM}=${encodeWorkout(config)}`;
}

/**
 * Extract a workout from anything a user might paste or open: a full share
 * URL, a "#w=…" hash, or a bare code. Returns null when there's nothing valid.
 */
export function parseShared(input: string | null | undefined): WorkoutConfig | null {
  if (!input) return null;
  const s = input.trim();
  const m = /(?:[#&?]|^)w=([^&\s#]+)/.exec(s);
  const code = m ? safeDecodeURI(m[1]) : s;
  return decodeWorkout(code);
}

function safeDecodeURI(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
