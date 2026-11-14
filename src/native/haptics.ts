import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { quietly } from './platform';

/** Feedback kinds emitted by the cue player (cues.ts). */
export type HapticKind = 'countdown' | 'work' | 'rest' | 'prep' | 'milestone' | 'finish' | 'click';

/**
 * Native haptics (Taptic Engine on iOS, vibrator effects on Android).
 * iOS ignores navigator.vibrate entirely, so in the app every cue goes through here.
 */
export function nativeHaptic(kind: HapticKind): void {
  switch (kind) {
    case 'countdown':
      quietly(() => Haptics.impact({ style: ImpactStyle.Medium }));
      break;
    case 'work':
      // Strong double hit: "go".
      quietly(() => Haptics.impact({ style: ImpactStyle.Heavy }));
      setTimeout(() => quietly(() => Haptics.impact({ style: ImpactStyle.Heavy })), 160);
      break;
    case 'rest':
      quietly(() => Haptics.impact({ style: ImpactStyle.Medium }));
      break;
    case 'prep':
      quietly(() => Haptics.impact({ style: ImpactStyle.Light }));
      break;
    case 'milestone':
      quietly(() => Haptics.notification({ type: NotificationType.Warning }));
      break;
    case 'finish':
      quietly(() => Haptics.notification({ type: NotificationType.Success }));
      break;
    case 'click':
      quietly(() => Haptics.impact({ style: ImpactStyle.Light }));
      break;
  }
}
