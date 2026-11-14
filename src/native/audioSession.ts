import { registerPlugin } from '@capacitor/core';
import { platform, quietly } from './platform';

/**
 * How Pulse's beeps share the speaker with the user's music.
 *
 * - iOS app: a tiny native plugin (ios/App/App/PulseAudioPlugin.swift) sets
 *   AVAudioSession to .playback, adding .mixWithOthers when "Play over music"
 *   is on, so beeps play over Spotify/Apple Music instead of stopping it.
 *   AppDelegate already sets .playback + .mixWithOthers at launch.
 * - Safari / iOS PWA: the Audio Session API (iOS 16.4+): "ambient" mixes with
 *   other audio; "auto" is WebKit's default.
 * - Android (app and web): Web Audio never takes audio focus, so it always
 *   mixes; nothing to do.
 */

interface PulseAudioPlugin {
  configure(options: { mixWithOthers: boolean }): Promise<void>;
}

const PulseAudio = registerPlugin<PulseAudioPlugin>('PulseAudio');

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

let last: boolean | null = null;

export function applyAudioSession(mixWithMusic: boolean): void {
  if (last === mixWithMusic) return;
  last = mixWithMusic;
  const p = platform();
  if (p === 'ios') {
    quietly(() => PulseAudio.configure({ mixWithOthers: mixWithMusic }));
    return;
  }
  if (p === 'web') {
    try {
      const s = (navigator as AudioSessionNav).audioSession;
      if (s && typeof s === 'object') s.type = mixWithMusic ? 'ambient' : 'auto';
    } catch {
      /* ignore */
    }
  }
}

/** Test hook. */
export function __resetAudioSessionForTests(): void {
  last = null;
}
