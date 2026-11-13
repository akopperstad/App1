import type { Cue, Segment } from '../engine/types';
import type { Settings } from '../state/store';
import { setVolume, unlockAudio } from './context';
import { minutePhrase, segmentPhrase } from './phrases';
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
} satisfies Record<string, number[]>;

function vibrate(settings: Settings, pattern: number[]): void {
  if (!settings.vibration) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
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
let flushScheduled = false;

/** Drop queued phrases and silence anything being spoken. */
function silence(): void {
  pending = [];
  stopSpeech();
}

function speak(settings: Settings, text: string): void {
  if (!settings.voice || !text) return;
  pendingVolume = settings.volume;
  if (!pending.includes(text)) pending.push(text);
  if (flushScheduled) return;
  flushScheduled = true;
  later(0, () => {
    flushScheduled = false;
    const phrase = pending.join('. ');
    pending = [];
    if (phrase) say(phrase, pendingVolume);
  });
}

// Dedupe sounds triggered in the same tick (one blip, not two).
let lastSound = '';
let lastSoundAt = 0;
function sound(settings: Settings, name: string, fn: () => void): void {
  if (!settings.sound || !(settings.volume > 0)) return;
  const now = Date.now();
  if (name === lastSound && now - lastSoundAt < 150) return;
  lastSound = name;
  lastSoundAt = now;
  setVolume(settings.volume);
  fn();
}

function enterSegment(seg: Segment, settings: Settings): void {
  if (seg.kind === 'work') {
    sound(settings, 'go', goTone);
    vibrate(settings, PATTERN.work);
  } else if (seg.kind === 'rest') {
    sound(settings, 'rest', restTone);
    vibrate(settings, PATTERN.rest);
  } else {
    sound(settings, 'tick', softTick);
    vibrate(settings, PATTERN.prep);
  }
  speak(settings, segmentPhrase(seg));
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
          vibrate(settings, PATTERN.countdown);
          break;
        case 'halfway':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, PATTERN.milestone);
          speak(settings, 'Halfway');
          break;
        case 'tenSeconds':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, PATTERN.milestone);
          speak(settings, 'Ten seconds');
          break;
        case 'minute':
          if (!settings.milestoneCues) break;
          sound(settings, 'blip', doubleBlip);
          vibrate(settings, PATTERN.milestone);
          speak(settings, minutePhrase(cue.minutesRemaining, cue.minutesElapsed));
          break;
        case 'finish':
          sound(settings, 'finish', finishFanfare);
          vibrate(settings, PATTERN.finish);
          speak(settings, 'Time! Great work');
          break;
        case 'pause':
          // A stale "Ten seconds" must not be spoken while the clock is stopped.
          silence();
          sound(settings, 'pause', () => click(false));
          vibrate(settings, PATTERN.click);
          break;
        case 'resume':
          sound(settings, 'resume', () => click(true));
          vibrate(settings, PATTERN.click);
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
          vibrate(s, PATTERN.countdown);
        });
      }
      later(3 * step, () => {
        sound(s, 'test-go', goTone);
        vibrate(s, PATTERN.work);
      });
      later(3 * step + 600, () => speak(s, 'Sound check'));
    } catch {
      /* ignore */
    }
  },
};
