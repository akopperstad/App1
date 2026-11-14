import { useEffect } from 'react';
import type { TimerEngine } from '../engine/engine';
import { getT } from '../i18n';
import { settingsStore } from '../state/store';
import { onAppActiveChange } from './app';
import {
  armBackgroundCues,
  clearDelivered,
  disarmBackgroundCues,
  prepareBackgroundCues,
} from './background';
import { isNative } from './platform';
import { planAlerts } from './schedule';

/**
 * Run screen hook-up for background cues (native app only).
 *
 * - First start of a timer: create the channel / ask for notification permission.
 * - App leaves the foreground while running (+ settings.backgroundAlerts):
 *   schedule a notification for every upcoming segment boundary.
 * - App returns, or the timer is paused / reset, or the Run screen goes away:
 *   cancel them all. (Skip / ±time / finish are only possible in the
 *   foreground, where nothing is armed; returning always disarms first.)
 */
export function useBackgroundCues(engine: TimerEngine): void {
  useEffect(() => {
    if (!isNative()) return;
    let asked = false;

    const arm = () => {
      if (!settingsStore.get().backgroundAlerts || engine.getStatus() !== 'running') return;
      const s = engine.tick(); // bring the timeline up to "now" first
      if (s.status !== 'running') return;
      void armBackgroundCues(planAlerts(engine.getSegments(), s.segmentIndex, s.segmentElapsedMs, undefined, getT()));
    };

    const offActive = onAppActiveChange((active) => {
      if (active) {
        void disarmBackgroundCues();
        void clearDelivered();
      } else {
        arm();
      }
    });

    const unsub = engine.subscribe(() => {
      const st = engine.getStatus();
      if (st === 'running' && !asked && settingsStore.get().backgroundAlerts) {
        asked = true;
        void prepareBackgroundCues();
      }
      if (st === 'paused' || st === 'idle') void disarmBackgroundCues();
    });

    return () => {
      offActive();
      unsub();
      void disarmBackgroundCues();
    };
  }, [engine]);
}
