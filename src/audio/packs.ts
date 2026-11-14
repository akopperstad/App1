/**
 * Sound packs: five distinct synthesized timbres for the same set of cues.
 *
 * Every cue builder takes the context, the output node (master gain) and a
 * base offset in seconds (so a preview can lay out a whole sequence in one
 * scheduling pass). Builders only use oscillators, gains, biquads and buffer
 * sources — available everywhere Web Audio is — and every envelope ramps
 * from/to silence so nothing clicks.
 */
import type { SoundPack } from '../state/store';

export type CueBuilder = (ctx: AudioContext, out: AudioNode, at?: number) => void;

export interface PackDef {
  /** 3-2-1 countdown. */
  countdown: CueBuilder;
  /** Into a work segment. */
  go: CueBuilder;
  /** Into a rest segment. */
  rest: CueBuilder;
  /** Get ready / prep. */
  tick: CueBuilder;
  /** End of workout. */
  finish: CueBuilder;
  /** Halfway / 10 s / minute marks. */
  milestone: CueBuilder;
  /** Pause (down) / resume (up). */
  click: (ctx: AudioContext, out: AudioNode, up: boolean, at?: number) => void;
}

/** Small scheduling lead so the first sample is never in the past. */
const LEAD = 0.015;
const SILENT = 0.0001;

function startTime(ctx: AudioContext, at: number): number {
  return ctx.currentTime + LEAD + at;
}

/** Disconnect a node when `src` ends (frees the graph). */
function freeOnEnd(src: AudioScheduledSourceNode, node: AudioNode): void {
  src.onended = () => {
    try {
      node.disconnect();
    } catch {
      /* ignore */
    }
  };
}

function osc(ctx: AudioContext, type: OscillatorType, freq: number, t0: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  return o;
}

function gainNode(ctx: AudioContext, value: number, dest: AudioNode | AudioParam): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(dest as AudioNode);
  return g;
}

// ------------------------------------------------------------------ noise

const noiseCache = new WeakMap<AudioContext, AudioBuffer | null>();

/** One second of white noise, cached per context (null if unsupported). */
function noiseBuffer(ctx: AudioContext): AudioBuffer | null {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx) ?? null;
  let buf: AudioBuffer | null = null;
  try {
    const rate = ctx.sampleRate || 44100;
    const b = ctx.createBuffer(1, rate, rate);
    if (b && typeof b.getChannelData === 'function') {
      const data = b.getChannelData(0);
      // Deterministic LCG noise: same timbre every time, no Math.random cost.
      let x = 22222;
      for (let i = 0; i < data.length; i++) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (x / 0x3fffffff - 1) * 0.9;
      }
      buf = b;
    }
  } catch {
    buf = null;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

/** Filtered noise burst (breath, wood, hammer transients). */
function noise(
  ctx: AudioContext,
  out: AudioNode,
  o: { at: number; dur: number; gain: number; freq: number; q: number; type?: BiquadFilterType; attack?: number },
): void {
  const buf = noiseBuffer(ctx);
  if (!buf) return;
  const t0 = startTime(ctx, o.at);
  const end = t0 + o.dur;
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.002));
  env.gain.exponentialRampToValueAtTime(SILENT, end);
  env.connect(out);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.value = o.freq;
  f.Q.value = o.q;
  f.connect(env);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(f);
  freeOnEnd(src, env);
  src.start(t0);
  if (typeof src.stop === 'function') src.stop(end + 0.02);
}

// ------------------------------------------------------------------ classic: gym beep

interface BeepOpts {
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** Amount of the bright square layer, 0..1. */
  bite?: number;
  glideTo?: number;
}

/**
 * Sine fundamental + soft octave + a lowpassed square layer: the odd
 * harmonics give the classic "gym clock" punch without sounding like a buzzer.
 */
function beep(ctx: AudioContext, out: AudioNode, freq: number, o: BeepOpts): void {
  const t0 = startTime(ctx, o.at ?? 0);
  const dur = Math.max(0.03, o.dur);
  const attack = Math.min(o.attack ?? 0.006, dur / 3);
  const release = Math.min(o.release ?? Math.min(0.12, dur * 0.45), dur - attack);
  const peak = o.gain ?? 0.5;
  const bite = o.bite ?? 0.35;
  const end = t0 + dur;

  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.setValueAtTime(peak, end - release);
  env.gain.exponentialRampToValueAtTime(SILENT, end);
  env.connect(out);

  const oscs: OscillatorNode[] = [];
  const mk = (type: OscillatorType, mult: number, level: number, dest: AudioNode) => {
    const o2 = osc(ctx, type, freq * mult, t0);
    if (o.glideTo) o2.frequency.exponentialRampToValueAtTime(o.glideTo * mult, end);
    o2.connect(gainNode(ctx, level, dest));
    oscs.push(o2);
  };
  mk('sine', 1, 0.75, env);
  mk('sine', 2, 0.12, env);
  if (bite > 0) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, freq * 4.5);
    lp.Q.value = 0.7;
    lp.connect(env);
    mk('square', 1, 0.22 * bite, lp);
  }
  for (const x of oscs) {
    x.start(t0);
    x.stop(end + 0.02);
  }
  freeOnEnd(oscs[0], env);
}

const classic: PackDef = {
  countdown: (ctx, out, at = 0) => beep(ctx, out, 880, { at, dur: 0.13, gain: 0.55, bite: 0.55, release: 0.05 }),
  go: (ctx, out, at = 0) => {
    beep(ctx, out, 1320, { at, dur: 0.5, gain: 0.6, bite: 0.6, release: 0.16 });
    beep(ctx, out, 660, { at, dur: 0.5, gain: 0.16, bite: 0.2, release: 0.16 });
  },
  rest: (ctx, out, at = 0) => {
    beep(ctx, out, 1318.5, { at, dur: 0.2, gain: 0.45, bite: 0.3, release: 0.07 });
    beep(ctx, out, 880, { at: at + 0.2, dur: 0.38, gain: 0.45, bite: 0.25, release: 0.2 });
  },
  tick: (ctx, out, at = 0) => {
    beep(ctx, out, 1760, { at, dur: 0.05, gain: 0.28, bite: 0, attack: 0.002, release: 0.04 });
    beep(ctx, out, 2637, { at: at + 0.07, dur: 0.06, gain: 0.2, bite: 0, attack: 0.002, release: 0.05 });
  },
  finish: (ctx, out, at = 0) => {
    [1046.5, 1318.5, 1568].forEach((f, i) =>
      beep(ctx, out, f, { at: at + i * 0.13, dur: 0.14, gain: 0.45, bite: 0.45, release: 0.05 }),
    );
    beep(ctx, out, 2093, { at: at + 0.42, dur: 0.9, gain: 0.5, bite: 0.45, release: 0.45 });
    beep(ctx, out, 1046.5, { at: at + 0.42, dur: 0.9, gain: 0.22, bite: 0.15, release: 0.45 });
  },
  milestone: (ctx, out, at = 0) => {
    beep(ctx, out, 1568, { at, dur: 0.06, gain: 0.3, bite: 0.2, attack: 0.003, release: 0.03 });
    beep(ctx, out, 1568, { at: at + 0.11, dur: 0.06, gain: 0.3, bite: 0.2, attack: 0.003, release: 0.03 });
  },
  click: (ctx, out, up, at = 0) =>
    beep(ctx, out, up ? 1200 : 900, {
      at,
      dur: 0.045,
      gain: 0.3,
      bite: 0,
      attack: 0.002,
      release: 0.035,
      glideTo: up ? 1500 : 700,
    }),
};

// ------------------------------------------------------------------ boxing: ring bell

/**
 * Struck bell: a set of inharmonic partials, each with its own exponential
 * decay (high partials die first, so the tone "darkens" as it rings), a
 * slightly detuned twin of the fundamental for the shimmering beat of real
 * bronze, and a tiny filtered-noise hammer transient.
 */
const BELL_PARTIALS: [ratio: number, amp: number, decay: number][] = [
  [1, 1, 1],
  [1.004, 0.5, 0.95],
  [2.0, 0.28, 0.6],
  [2.76, 0.42, 0.5],
  [4.07, 0.22, 0.32],
  [5.4, 0.16, 0.22],
  [8.93, 0.06, 0.1],
];

function bell(ctx: AudioContext, out: AudioNode, freq: number, o: { at: number; ring: number; gain: number }): void {
  const t0 = startTime(ctx, o.at);
  const bus = gainNode(ctx, o.gain, out);
  let first: OscillatorNode | null = null;
  for (const [ratio, amp, decay] of BELL_PARTIALS) {
    const f = freq * ratio;
    if (f > 16000) continue;
    const d = Math.max(0.06, o.ring * decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.exponentialRampToValueAtTime(amp * 0.5, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(SILENT, t0 + d);
    env.connect(bus);
    const o2 = osc(ctx, 'sine', f, t0);
    o2.connect(env);
    o2.start(t0);
    o2.stop(t0 + d + 0.02);
    first ??= o2;
  }
  if (first) freeOnEnd(first, bus);
  noise(ctx, out, { at: o.at, dur: 0.018, gain: o.gain * 0.35, freq: freq * 3, q: 1.2, type: 'highpass' });
}

/** Wooden clapper sticks — the classic boxing "10 seconds" warning. */
function clack(ctx: AudioContext, out: AudioNode, at: number, gain = 0.55): void {
  noise(ctx, out, { at, dur: 0.05, gain, freq: 2300, q: 2.5 });
  const t0 = startTime(ctx, at);
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(gain * 0.6, t0 + 0.002);
  env.gain.exponentialRampToValueAtTime(SILENT, t0 + 0.045);
  env.connect(out);
  const o2 = osc(ctx, 'triangle', 1250, t0);
  o2.frequency.exponentialRampToValueAtTime(900, t0 + 0.045);
  o2.connect(env);
  freeOnEnd(o2, env);
  o2.start(t0);
  o2.stop(t0 + 0.07);
}

const boxing: PackDef = {
  countdown: (ctx, out, at = 0) => bell(ctx, out, 1480, { at, ring: 0.32, gain: 0.5 }),
  go: (ctx, out, at = 0) => {
    // Big single strike that rings out — "round starts".
    bell(ctx, out, 980, { at, ring: 2.4, gain: 0.7 });
    bell(ctx, out, 980, { at: at + 0.16, ring: 2.0, gain: 0.45 });
  },
  rest: (ctx, out, at = 0) => {
    // Ding-ding-ding — "end of round".
    for (let i = 0; i < 3; i++) bell(ctx, out, 880, { at: at + i * 0.2, ring: i === 2 ? 1.6 : 0.8, gain: 0.55 });
  },
  tick: (ctx, out, at = 0) => bell(ctx, out, 2093, { at, ring: 0.35, gain: 0.25 }),
  finish: (ctx, out, at = 0) => {
    // Rapid ringing as the fight ends, then one long tail.
    for (let i = 0; i < 7; i++) bell(ctx, out, 880, { at: at + i * 0.12, ring: 0.5, gain: 0.45 });
    bell(ctx, out, 880, { at: at + 0.9, ring: 2.8, gain: 0.65 });
  },
  milestone: (ctx, out, at = 0) => {
    clack(ctx, out, at);
    clack(ctx, out, at + 0.14);
  },
  click: (ctx, out, up, at = 0) => clack(ctx, out, at, up ? 0.35 : 0.25),
};

// ------------------------------------------------------------------ whistle: referee pea whistle

/**
 * Pea whistle: a ~3 kHz sine whose pitch *and* level are modulated by a
 * ~30 Hz LFO (the pea rattling in the chamber = the trill), a weak second
 * harmonic, and band-passed breath noise around the pitch.
 */
function whistle(
  ctx: AudioContext,
  out: AudioNode,
  o: { at: number; dur: number; gain?: number; freq?: number; trill?: number; depth?: number },
): void {
  const t0 = startTime(ctx, o.at);
  const dur = Math.max(0.04, o.dur);
  const end = t0 + dur;
  const freq = o.freq ?? 3000;
  const peak = o.gain ?? 0.4;
  const trill = o.trill ?? 30;
  const depth = o.depth ?? 160;

  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.018, dur / 4));
  env.gain.setValueAtTime(peak, end - Math.min(0.05, dur / 3));
  env.gain.exponentialRampToValueAtTime(SILENT, end);
  env.connect(out);

  // Tremolo stage: base 0.7, LFO adds ±0.3.
  const trem = ctx.createGain();
  trem.gain.value = 0.7;
  trem.connect(env);

  const carrier = osc(ctx, 'sine', freq, t0);
  // Slight upward scoop at the start of a blow.
  carrier.frequency.setValueAtTime(freq * 0.94, t0);
  carrier.frequency.exponentialRampToValueAtTime(freq, t0 + Math.min(0.04, dur / 3));
  carrier.connect(trem);
  const h2 = osc(ctx, 'sine', freq * 2, t0);
  h2.connect(gainNode(ctx, 0.08, trem));

  const lfo = osc(ctx, 'sine', trill, t0);
  if (depth > 0) {
    lfo.connect(gainNode(ctx, depth, carrier.frequency));
    lfo.connect(gainNode(ctx, depth * 2, h2.frequency));
    lfo.connect(gainNode(ctx, 0.3, trem.gain));
  }
  for (const x of [carrier, h2, lfo]) {
    x.start(t0);
    x.stop(end + 0.02);
  }
  freeOnEnd(carrier, env);
  noise(ctx, out, { at: o.at, dur, gain: peak * 0.18, freq, q: 6, attack: 0.012 });
}

const whistlePack: PackDef = {
  countdown: (ctx, out, at = 0) => whistle(ctx, out, { at, dur: 0.12, freq: 3150, depth: 40, gain: 0.38 }),
  go: (ctx, out, at = 0) => whistle(ctx, out, { at, dur: 0.75, freq: 3000, gain: 0.45 }),
  rest: (ctx, out, at = 0) => {
    whistle(ctx, out, { at, dur: 0.2, freq: 2800, gain: 0.4 });
    whistle(ctx, out, { at: at + 0.3, dur: 0.2, freq: 2800, gain: 0.4 });
  },
  tick: (ctx, out, at = 0) => whistle(ctx, out, { at, dur: 0.07, freq: 3500, depth: 0, gain: 0.22 }),
  finish: (ctx, out, at = 0) => {
    whistle(ctx, out, { at, dur: 0.22, gain: 0.45 });
    whistle(ctx, out, { at: at + 0.32, dur: 0.22, gain: 0.45 });
    whistle(ctx, out, { at: at + 0.64, dur: 1.1, gain: 0.5 });
  },
  milestone: (ctx, out, at = 0) => {
    whistle(ctx, out, { at, dur: 0.07, freq: 3300, depth: 0, gain: 0.3 });
    whistle(ctx, out, { at: at + 0.12, dur: 0.07, freq: 3300, depth: 0, gain: 0.3 });
  },
  click: (ctx, out, up, at = 0) =>
    whistle(ctx, out, { at, dur: 0.05, freq: up ? 3400 : 2700, depth: 0, gain: 0.2 }),
};

// ------------------------------------------------------------------ soft: marimba

/**
 * Mallet / marimba bar: sine fundamental with the bar's characteristic
 * ~4x and ~10x partials, which decay much faster than the body — a warm,
 * rounded "bonk" that stays calm for yoga and mobility work.
 */
function mallet(ctx: AudioContext, out: AudioNode, freq: number, o: { at: number; dur: number; gain: number }): void {
  const t0 = startTime(ctx, o.at);
  const bus = gainNode(ctx, o.gain, out);
  const parts: [number, number, number][] = [
    [1, 1, 1],
    [3.93, 0.22, 0.18],
    [9.2, 0.05, 0.06],
  ];
  let first: OscillatorNode | null = null;
  for (const [ratio, amp, decay] of parts) {
    const d = Math.max(0.05, o.dur * decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.exponentialRampToValueAtTime(amp * 0.6, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(SILENT, t0 + d);
    env.connect(bus);
    const o2 = osc(ctx, ratio === 1 ? 'triangle' : 'sine', freq * ratio, t0);
    o2.connect(env);
    o2.start(t0);
    o2.stop(t0 + d + 0.02);
    first ??= o2;
  }
  // A pure sine an octave up softens the triangle into a woody tone.
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(0.25, t0 + 0.006);
  env.gain.exponentialRampToValueAtTime(SILENT, t0 + o.dur * 0.6);
  env.connect(bus);
  const s = osc(ctx, 'sine', freq * 2, t0);
  s.connect(env);
  s.start(t0);
  s.stop(t0 + o.dur * 0.6 + 0.02);
  if (first) freeOnEnd(first, bus);
}

const soft: PackDef = {
  countdown: (ctx, out, at = 0) => mallet(ctx, out, 659.25, { at, dur: 0.55, gain: 0.55 }),
  go: (ctx, out, at = 0) => {
    mallet(ctx, out, 783.99, { at, dur: 1.3, gain: 0.55 });
    mallet(ctx, out, 1174.66, { at: at + 0.06, dur: 1.3, gain: 0.4 });
  },
  rest: (ctx, out, at = 0) => {
    mallet(ctx, out, 659.25, { at, dur: 0.8, gain: 0.5 });
    mallet(ctx, out, 523.25, { at: at + 0.22, dur: 1.2, gain: 0.5 });
  },
  tick: (ctx, out, at = 0) => mallet(ctx, out, 1046.5, { at, dur: 0.45, gain: 0.3 }),
  finish: (ctx, out, at = 0) => {
    // Major pentatonic run, ending on a calm open fifth.
    [523.25, 587.33, 659.25, 783.99, 880].forEach((f, i) =>
      mallet(ctx, out, f, { at: at + i * 0.12, dur: 0.6, gain: 0.45 }),
    );
    mallet(ctx, out, 1046.5, { at: at + 0.62, dur: 1.8, gain: 0.5 });
    mallet(ctx, out, 783.99, { at: at + 0.62, dur: 1.8, gain: 0.3 });
  },
  milestone: (ctx, out, at = 0) => {
    mallet(ctx, out, 1318.5, { at, dur: 0.35, gain: 0.3 });
    mallet(ctx, out, 1318.5, { at: at + 0.14, dur: 0.35, gain: 0.3 });
  },
  click: (ctx, out, up, at = 0) => mallet(ctx, out, up ? 880 : 659.25, { at, dur: 0.2, gain: 0.25 }),
};

// ------------------------------------------------------------------ digital: watch beeps

/** Hard-gated square wave, like a sports-watch piezo. Lightly lowpassed to tame aliasing. */
function square(ctx: AudioContext, out: AudioNode, freq: number, o: { at: number; dur: number; gain?: number }): void {
  const t0 = startTime(ctx, o.at);
  const end = t0 + Math.max(0.015, o.dur);
  const peak = o.gain ?? 0.2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.0015);
  env.gain.setValueAtTime(peak, end - 0.004);
  env.gain.exponentialRampToValueAtTime(SILENT, end);
  env.connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;
  lp.Q.value = 0.5;
  lp.connect(env);
  const o2 = osc(ctx, 'square', freq, t0);
  o2.connect(lp);
  freeOnEnd(o2, env);
  o2.start(t0);
  o2.stop(end + 0.02);
}

const digital: PackDef = {
  countdown: (ctx, out, at = 0) => square(ctx, out, 2730, { at, dur: 0.08 }),
  go: (ctx, out, at = 0) => square(ctx, out, 3200, { at, dur: 0.5, gain: 0.22 }),
  rest: (ctx, out, at = 0) => {
    square(ctx, out, 2400, { at, dur: 0.1 });
    square(ctx, out, 2400, { at: at + 0.16, dur: 0.1 });
  },
  tick: (ctx, out, at = 0) => square(ctx, out, 4000, { at, dur: 0.03, gain: 0.12 }),
  finish: (ctx, out, at = 0) => {
    // Alarm pattern: beep-beep-beep-beep ×3.
    for (let g = 0; g < 3; g++)
      for (let i = 0; i < 4; i++) square(ctx, out, 3200, { at: at + g * 0.6 + i * 0.1, dur: 0.06, gain: 0.2 });
  },
  milestone: (ctx, out, at = 0) => {
    square(ctx, out, 3200, { at, dur: 0.04, gain: 0.15 });
    square(ctx, out, 3200, { at: at + 0.09, dur: 0.04, gain: 0.15 });
  },
  click: (ctx, out, up, at = 0) => square(ctx, out, up ? 2600 : 2000, { at, dur: 0.02, gain: 0.12 }),
};

export const PACKS: Record<SoundPack, PackDef> = {
  classic,
  boxing,
  whistle: whistlePack,
  soft,
  digital,
};

export function packDef(pack: SoundPack | undefined): PackDef {
  return (pack && PACKS[pack]) || classic;
}
