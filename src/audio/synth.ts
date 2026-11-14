/**
 * Synthesized cue sounds, rendered in the user's chosen sound pack
 * (see packs.ts for the five timbres).
 *
 * Every function takes an optional `pack`; when omitted the pack is read from
 * the settings store, so existing call sites (`sound(settings, 'go', goTone)`)
 * automatically follow Settings → Sound style.
 */
import { settingsStore, type SoundPack } from '../state/store';
import { setVolume, unlockAudio, withAudio } from './context';
import { packDef, type PackDef } from './packs';

function currentPack(): SoundPack {
  try {
    return settingsStore.get().soundPack;
  } catch {
    return 'classic';
  }
}

function play(pack: SoundPack | undefined, build: (def: PackDef, ctx: AudioContext, out: AudioNode) => void, maxDelayMs?: number) {
  const def = packDef(pack ?? currentPack());
  withAudio((ctx, out) => build(def, ctx, out), maxDelayMs);
}

// ------------------------------------------------------------------ sounds

/** 3-2-1 countdown. */
export function countdownBeep(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.countdown(ctx, out), 350);
}

/** "GO": into a work segment. */
export function goTone(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.go(ctx, out));
}

/** Into rest. */
export function restTone(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.rest(ctx, out));
}

/** Soft tick: start / get ready / back to prep. */
export function softTick(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.tick(ctx, out));
}

/** Finish fanfare. */
export function finishFanfare(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.finish(ctx, out));
}

/** Milestone (10 s / halfway / minute). */
export function doubleBlip(pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.milestone(ctx, out), 400);
}

/** Pause / resume: tiny click. Resume clicks up, pause clicks down. */
export function click(up: boolean, pack?: SoundPack): void {
  play(pack, (d, ctx, out) => d.click(ctx, out, up), 300);
}

/**
 * Settings / onboarding preview: 3-2-1 countdown then the "go" sound of
 * `pack`, laid out sample-accurately in one pass. Call from a user gesture.
 */
export function previewPack(pack: SoundPack, volume?: number): void {
  try {
    unlockAudio();
    setVolume(volume ?? settingsStore.get().volume);
  } catch {
    /* ignore */
  }
  play(
    pack,
    (d, ctx, out) => {
      d.countdown(ctx, out, 0);
      d.countdown(ctx, out, 0.42);
      d.countdown(ctx, out, 0.84);
      d.go(ctx, out, 1.26);
    },
    1000,
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
