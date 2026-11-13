import type { Cue } from '../engine/types';
import type { Settings } from '../state/store';

/**
 * CONTRACT (implemented by the audio agent):
 *  - unlock(): must be called from a user gesture (Start button) to enable
 *    Web Audio / speech on iOS & Android.
 *  - handle(cue, settings): play beeps / speech / vibration for a cue.
 *  - test(): play a sample (used by Settings "Test sound").
 */
export const cuePlayer = {
  unlock(): void {},
  handle(_cue: Cue, _settings: Settings): void {},
  test(_settings: Settings): void {},
};
