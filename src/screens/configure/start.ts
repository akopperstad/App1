import { cuePlayer } from '../../audio/cues';
import type { WorkoutConfig } from '../../engine/types';
import type { Nav } from '../../nav';

/**
 * Navigate to the run screen. Unlocks audio first — this must run inside the
 * user's tap handler for iOS / Android to allow Web Audio & speech.
 */
export function startWorkout(nav: Nav, config: WorkoutConfig) {
  try {
    cuePlayer.unlock();
  } catch {
    /* audio is optional */
  }
  nav.go({ name: 'run', config });
}
