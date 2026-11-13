/**
 * Synthesized cue sounds. All sounds are built from short enveloped
 * "voices": a sine fundamental plus a filtered square/triangle layer that
 * adds upper harmonics so beeps cut through loud gym music without being
 * harsh. Envelopes always ramp from/to silence, so there are no clicks.
 */
import { withAudio } from './context';

interface ToneOpts {
  /** Seconds after "now" to start. */
  at?: number;
  /** Total duration, seconds (incl. release). */
  dur: number;
  /** Peak gain for this voice (before master). */
  gain?: number;
  attack?: number;
  release?: number;
  /** Amount of the bright harmonic layer, 0..1. */
  bite?: number;
  /** Frequency to glide to over the duration. */
  glideTo?: number;
}

/** Small scheduling lead so the first sample is never in the past. */
const LEAD = 0.015;

function voice(ctx: AudioContext, out: AudioNode, freq: number, o: ToneOpts): void {
  const t0 = ctx.currentTime + LEAD + (o.at ?? 0);
  const dur = Math.max(0.03, o.dur);
  const attack = Math.min(o.attack ?? 0.006, dur / 3);
  const release = Math.min(o.release ?? Math.min(0.12, dur * 0.45), dur - attack);
  const peak = o.gain ?? 0.5;
  const bite = o.bite ?? 0.35;
  const end = t0 + dur;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.setValueAtTime(peak, end - release);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(out);

  const oscs: OscillatorNode[] = [];
  const mk = (type: OscillatorType, mult: number, level: number, dest: AudioNode) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, t0);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo * mult, end);
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g);
    g.connect(dest);
    oscs.push(osc);
  };

  // Body: pure sine fundamental + a soft octave.
  mk('sine', 1, 0.75, env);
  mk('sine', 2, 0.12, env);

  // Bite: square wave through a lowpass — odd harmonics give the classic
  // "gym clock" punch; the filter keeps it from sounding like a buzzer.
  if (bite > 0) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, freq * 4.5);
    lp.Q.value = 0.7;
    lp.connect(env);
    mk('square', 1, 0.22 * bite, lp);
  }

  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(end + 0.02);
  }
  // Free nodes after the voice finishes.
  oscs[0].onended = () => {
    try {
      env.disconnect();
    } catch {
      /* ignore */
    }
  };
}

function play(build: (ctx: AudioContext, out: AudioNode) => void, maxDelayMs?: number) {
  withAudio((ctx, out) => build(ctx, out), maxDelayMs);
}

// ------------------------------------------------------------------ sounds

/** 3-2-1 countdown: short bright beep (~880 Hz, 120 ms). */
export function countdownBeep(): void {
  play((ctx, out) => voice(ctx, out, 880, { dur: 0.13, gain: 0.55, bite: 0.55, release: 0.05 }), 350);
}

/** "GO": long higher tone (~1320 Hz, 450 ms) completing beep-beep-beep-BEEEP. */
export function goTone(): void {
  play((ctx, out) => {
    voice(ctx, out, 1320, { dur: 0.5, gain: 0.6, bite: 0.6, release: 0.16 });
    // A quiet fifth below adds weight without changing the perceived pitch.
    voice(ctx, out, 660, { dur: 0.5, gain: 0.16, bite: 0.2, release: 0.16 });
  });
}

/** Into rest: relaxed descending two-tone (E6 -> A5). */
export function restTone(): void {
  play((ctx, out) => {
    voice(ctx, out, 1318.5, { dur: 0.2, gain: 0.45, bite: 0.3, release: 0.07 });
    voice(ctx, out, 880, { at: 0.2, dur: 0.38, gain: 0.45, bite: 0.25, release: 0.2 });
  });
}

/** Soft tick: start / get ready / back to prep. */
export function softTick(): void {
  play((ctx, out) => {
    voice(ctx, out, 1760, { dur: 0.05, gain: 0.28, bite: 0, attack: 0.002, release: 0.04 });
    voice(ctx, out, 2637, { at: 0.07, dur: 0.06, gain: 0.2, bite: 0, attack: 0.002, release: 0.05 });
  });
}

/** Finish: rising C-E-G arpeggio then a long bright high C. */
export function finishFanfare(): void {
  play((ctx, out) => {
    const notes = [1046.5, 1318.5, 1568];
    notes.forEach((f, i) =>
      voice(ctx, out, f, { at: i * 0.13, dur: 0.14, gain: 0.45, bite: 0.45, release: 0.05 }),
    );
    voice(ctx, out, 2093, { at: 0.42, dur: 0.9, gain: 0.5, bite: 0.45, release: 0.45 });
    voice(ctx, out, 1046.5, { at: 0.42, dur: 0.9, gain: 0.22, bite: 0.15, release: 0.45 });
  });
}

/** Milestone (10 s / halfway / minute): subtle double blip. */
export function doubleBlip(): void {
  play(
    (ctx, out) => {
      voice(ctx, out, 1568, { dur: 0.06, gain: 0.3, bite: 0.2, attack: 0.003, release: 0.03 });
      voice(ctx, out, 1568, { at: 0.11, dur: 0.06, gain: 0.3, bite: 0.2, attack: 0.003, release: 0.03 });
    },
    400,
  );
}

/** Pause / resume: tiny click. Resume clicks up, pause clicks down. */
export function click(up: boolean): void {
  play(
    (ctx, out) =>
      voice(ctx, out, up ? 1200 : 900, {
        dur: 0.045,
        gain: 0.3,
        bite: 0,
        attack: 0.002,
        release: 0.035,
        glideTo: up ? 1500 : 700,
      }),
    300,
  );
}

/** Schedule `fn` after `ms` (never throws). */
export function later(ms: number, fn: () => void): void {
  try {
    setTimeout(() => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }, ms);
  } catch {
    /* ignore */
  }
}
