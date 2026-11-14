import type { Cue, Segment } from '../engine/types';
import { resolveLang, spokenPhrases, type SpokenPhrases } from '../i18n';
import type { Settings, SoundPack } from '../state/store';
import { backgroundCuesArmed } from '../native/background';
import { nativeHaptic, type HapticKind } from '../native/haptics';
import { isNative } from '../native/platform';
import { setVolume, unlockAudio } from './context';
import { primeSpeech, say, stopSpeech } from './speech';
import {
  click,
  countdownBeep,
  doubleBlip,
  finishFanfare,
  goTone,
  later,
  restTone,
  softTick,
} from './synth';

// ------------------------------------------------------------------ vibration

const PATTERN = {
  countdown: [70],
  work: [400, 90, 400],
  rest: [220, 90, 220],
  prep: [40],
  milestone: [40, 70, 40],
  finish: [120, 70, 120, 70, 120, 70, 650],
  click: [20],
} satisfies Record<HapticKind, number[]>;

/** Web: navigator.vibrate pattern. Native app: Taptic / vibrator effects (iOS has no navigator.vibrate). */
function vibrate(settings: Settings, kind: HapticKind): void {
  if (!settings.vibration) return;
  try {
    if (isNative()) {
      nativeHaptic(kind);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[kind]);
    }
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ speech coalescing

/**
 * Cues crossed in the same engine tick (e.g. "halfway" and a minute marker
 * at 2:00 of a 4:00 AMRAP) are joined into one phrase instead of the second
 * cancelling the first. Phrases are flushed on the next macrotask.
 */
let pending: string[] = [];
let pendingVolume = 1;
let pendingLang = 'en-US';
let flushScheduled = false;

/** Drop queued phrases and silence anything being spoken. */
function silence(): void {
  pending = [];
  stopSpeech();
}

function speak(settings: Settings, text: string): void {
  if (!settings.voice || !text) return;
  pendingVolume = settings.volume;
  pendingLang = phrases(settings).speechLang;
  if (!pending.includes(text)) pending.push(text);
  if (flushScheduled) return;
  flushScheduled = true;
  later(0, () => {
    flushScheduled = false;
    const phrase = pending.join('. ');
    pending = [];
    if (phrase) say(phrase, pendingVolume, pendingLang);
  });
}

/** Spoken phrases in the user's language (settings.language, 'auto' = device). */
function phrases(settings: Settings): SpokenPhrases {
  return spokenPhrases(resolveLang(settings.language));
}

// Dedupe sounds triggered in the same tick (one blip, not two).
let lastSound = '';
let lastSoundAt = 0;
function sound(settings: Settings, name: string, fn: (pack: SoundPack) => void): void {
  if (!settings.sound || !(settings.volume > 0)) return;
  const now = Date.now();
  if (name === lastSound && now - lastSoundAt < 150) return;
  lastSound = name;
  lastSoundAt = now;
  setVolume(settings.volume);
  fn(settings.soundPack);
}

function enterSegment(seg: Segment, settings: Settings): void {
  if (seg.kind === 'work') {
    sound(settings, 'go', goTone);
    vibrate(settings, 'work');
  } else if (seg.kind === 'rest') {
    sound(settings, 'rest', restTone);
    vibrate(settings, 'rest');
  } else {
    sound(settings, 'tick', softTick);
    vibrate(settings, 'prep');
  }
  speak(settings, phrases(settings).segment(seg));
}

// ------------------------------------------------------------------ public contract

export const cuePlayer = {
  /** Call synchronously inside the Start button's click handler. */
  unlock(): void {
    try {
      unlockAudio();
    } catch {
      /* ignore */
    }
    try {
      primeSpeech();
    } catch {
      /* ignore */
    }
  },

  /**
   * Silence speech (queued and in flight). Call when the run screen goes
   * away or the timer is reset, so no announcement outlives the workout.
   */
  stop(): void {
    try {
      silence();
    } catch {
      /* ignore */
    }
  },

  handle(cue: Cue, settings: Settings): void {
    // App in the background with system notifications standing in for cues
    // (native only): stay quiet so nothing plays twice.
    if (backgroundCuesArmed()) return;
    try {
      switch (cue.type) {
        case 'start':
          enterSegment(cue.segment, settings);
          break;
        case 'segment':
          enterSegment(cue.segment, settings);
          break;
        case 'countdown':
          if (!settings.countdownBeeps) break;
          if (cue.n < 1 || cue.n > 3) break;
          sound(settings, `cd${cue.n}`, countdownBeep);
          vibrate(settings, 'countdown');
          break;
        case 'halfway':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, 'milestone');
          speak(settings, phrases(settings).halfway);
          break;
        case 'tenSeconds':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, 'milestone');
          speak(settings, phrases(settings).tenSeconds);
          break;
        case 'minute':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, 'milestone');
          speak(settings, phrases(settings).minute(cue.minutesRemaining, cue.minutesElapsed));
          break;
        case 'finish':
          sound(settings, 'finish', finishFanfare);
          vibrate(settings, 'finish');
          speak(settings, phrases(settings).finish);
          break;
        case 'pause':
          // A stale "Ten seconds" must not be spoken while the clock is stopped.
          silence();
          sound(settings, 'pause', (p) => click(false, p));
          vibrate(settings, 'click');
          break;
        case 'resume':
          sound(settings, 'resume', (p) => click(true, p));
          vibrate(settings, 'click');
          break;
      }
    } catch {
      /* never let feedback break the timer */
    }
  },

  /** Demo for Settings → "Test sound": beep, beep, beep, BEEEP + "Sound check". */
  test(settings: Settings): void {
    try {
      cuePlayer.unlock();
      // An explicit test plays even if sound is toggled off, so the user can
      // hear what they would get — but always at their chosen volume.
      const s: Settings = { ...settings, sound: true };
      const step = 800;
      for (let i = 0; i < 3; i++) {
        later(i * step, () => {
          sound(s, `test${i}`, countdownBeep);
          vibrate(s, 'countdown');
        });
      }
      later(3 * step, () => {
        sound(s, 'test-go', goTone);
        vibrate(s, 'work');
      });
      later(3 * step + 600, () => speak(s, phrases(s).soundCheck));
    } catch {
      /* ignore */
    }
  },
};
