/**
 * Shared Web Audio context + output chain.
 *
 *   voice gains -> master (volume) -> compressor -> destination
 *
 * Everything is lazy and guarded so importing this module is safe under
 * SSR / jsdom, and no function here ever throws.
 */

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let failed = false;

function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Return (lazily creating) the shared context and master gain, or null if unavailable. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (ctx && master) return { ctx, master };
  if (failed) return null;
  const C = getCtor();
  if (!C) {
    failed = true;
    return null;
  }
  try {
    let c: AudioContext;
    try {
      c = new C({ latencyHint: 'interactive' });
    } catch {
      c = new C();
    }
    const comp = c.createDynamicsCompressor();
    // Gentle glue + limiting so stacked tones stay loud but never clip.
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    const m = c.createGain();
    m.gain.value = 0.8;
    m.connect(comp);
    comp.connect(c.destination);
    ctx = c;
    master = m;
    return { ctx, master };
  } catch {
    failed = true;
    return null;
  }
}

/** Map the 0..1 settings volume onto a perceptually even gain curve. */
export function setVolume(volume: number): void {
  const a = getAudio();
  if (!a) return;
  const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8;
  try {
    const g = v * v * 1.1; // squared curve feels linear to the ear
    a.master.gain.setTargetAtTime(g, a.ctx.currentTime, 0.01);
  } catch {
    /* ignore */
  }
}

function isRunning(c: AudioContext): boolean {
  return c.state === 'running';
}

/**
 * Run `fn` once the context is running. If the context is suspended or
 * 'interrupted' (iOS), try to resume first. Sounds that would be played
 * more than `maxDelayMs` late are dropped (a stale countdown beep is worse
 * than none).
 */
export function withAudio(fn: (ctx: AudioContext, out: GainNode) => void, maxDelayMs = 600): void {
  const a = getAudio();
  if (!a) return;
  const run = () => {
    try {
      fn(a.ctx, a.master);
    } catch {
      /* ignore */
    }
  };
  if (isRunning(a.ctx)) {
    run();
    return;
  }
  const t0 = Date.now();
  try {
    const p = a.ctx.resume();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (isRunning(a.ctx) && Date.now() - t0 <= maxDelayMs) run();
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * Must be called synchronously inside a user gesture: resumes the context
 * and plays a one-sample silent buffer, which is what unlocks audio on iOS.
 */
export function unlockAudio(): void {
  const a = getAudio();
  if (!a) return;
  try {
    const p = a.ctx.resume();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    const buf = a.ctx.createBuffer(1, 1, 22050);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(a.ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort resume after the app returns from the background or an audio
 * interruption (phone call, Siri). Not a gesture, so it may be refused; the
 * next cue retries via withAudio(). Never creates a context.
 */
export function resumeAudio(): void {
  if (!ctx || ctx.state === 'running') return;
  try {
    const p = ctx.resume();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}
