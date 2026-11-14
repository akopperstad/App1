import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { isNative, platform } from './platform';
import type { PlannedAlert } from './schedule';

/**
 * Background cues: system notifications (sound + vibration) at every upcoming
 * segment boundary while the app is backgrounded / the phone is locked.
 *
 * Lifecycle (driven by src/native/useBackgroundCues.ts):
 *   app goes inactive while running  -> arm(plan)
 *   app becomes active, pause, reset, leave Run, ... -> disarm()
 * While armed, in-app cues are muted (see cues.ts) so Android — where the web
 * view may keep running — does not beep twice.
 */

/** Android notification channel. Its sound/importance are fixed once created, hence the version suffix. */
export const CUE_CHANNEL_ID = 'workout-cues-v1';
/** Bundled sound: ios/App/App/pulse_cue.wav and android/app/src/main/res/raw/pulse_cue.wav. */
export const CUE_SOUND = 'pulse_cue.wav';
/** Notification ids we own: [BASE_ID, BASE_ID + MAX). */
export const BASE_ID = 7100;
const ID_SPAN = 100;
const THREAD = 'pulse-workout';

let armed = false;
/** Bumped by every arm/disarm so a slow, superseded schedule() can't leave alerts behind. */
let generation = 0;
let scheduledIds: number[] = [];
let chain: Promise<unknown> = Promise.resolve();
let prepared: Promise<boolean> | null = null;

/** Serialise native calls: a disarm must never overtake the arm it cancels. */
function enqueue(fn: () => Promise<unknown>): Promise<void> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return chain as Promise<void>;
}

/** True while background notifications are standing in for in-app cues. */
export function backgroundCuesArmed(): boolean {
  return armed;
}

/** Map a plan to plugin notifications, with absolute fire times from `nowMs`. */
export function toNotifications(plan: readonly PlannedAlert[], nowMs: number): LocalNotificationSchema[] {
  return plan.slice(0, ID_SPAN).map((a, i) => ({
    id: BASE_ID + i,
    title: a.title,
    body: a.body,
    // Never in the past: a boundary "now" fires immediately.
    schedule: { at: new Date(nowMs + Math.max(250, a.atMs)), allowWhileIdle: true },
    sound: CUE_SOUND,
    channelId: CUE_CHANNEL_ID,
    smallIcon: 'ic_stat_pulse',
    threadIdentifier: THREAD,
    group: THREAD,
    autoCancel: true,
    extra: { pulse: 'cue', kind: a.kind },
  }));
}

/**
 * Create the Android channel and ask for notification permission — once, the
 * first time a timer starts in the native app. Resolves true if alerts can be shown.
 */
export function prepareBackgroundCues(): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  prepared ??= (async () => {
    try {
      if (platform() === 'android') {
        await LocalNotifications.createChannel({
          id: CUE_CHANNEL_ID,
          name: 'Workout cues',
          description:
            'Sound and vibration at each work / rest change while your phone is locked or Pulse is in the background.',
          importance: 5,
          visibility: 1,
          sound: CUE_SOUND,
          vibration: true,
          lights: true,
          lightColor: '#FF5A1F',
        });
      }
      let p = await LocalNotifications.checkPermissions();
      if (p.display === 'prompt' || p.display === 'prompt-with-rationale') {
        p = await LocalNotifications.requestPermissions();
      }
      return p.display === 'granted';
    } catch {
      return false;
    }
  })();
  const p = prepared;
  // A denial is final for this session, but let a later start retry after an error.
  p.then((ok) => {
    if (!ok) prepared = null;
  }).catch(() => {});
  return p;
}

async function canNotify(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Android 12+: only ask for exact alarms we are actually allowed to set (never open Settings from the background). */
async function exactAllowed(): Promise<boolean> {
  if (platform() !== 'android') return true;
  try {
    const s = await LocalNotifications.checkExactNotificationSetting();
    return s.exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/** Replace any pending alerts with `plan` (offsets from now). No-op on the web or for an empty plan. */
export function armBackgroundCues(plan: readonly PlannedAlert[]): Promise<void> {
  if (!isNative()) return Promise.resolve();
  const gen = ++generation;
  const nowMs = Date.now();
  return enqueue(async () => {
    await cancelScheduled();
    if (gen !== generation || plan.length === 0) return;
    // Never prompt from here (the app is going to the background): only check.
    const ok = await canNotify();
    if (!ok || gen !== generation) return;
    const exact = await exactAllowed();
    // Time spent in the awaits above already elapsed on the workout clock.
    const notifications = toNotifications(plan, nowMs)
      .filter((n) => (n.schedule?.at?.getTime() ?? 0) > Date.now() - 500)
      .map((n) => ({ ...n, isExactNotification: exact }));
    if (notifications.length === 0) return;
    scheduledIds = notifications.map((n) => n.id);
    await LocalNotifications.schedule({ notifications });
    if (gen === generation) armed = true;
    else await cancelScheduled();
  });
}

/** Cancel every pending alert and hand cues back to the app. Safe to call any time. */
export function disarmBackgroundCues(): Promise<void> {
  armed = false;
  if (!isNative()) return Promise.resolve();
  generation++;
  return enqueue(cancelScheduled);
}

async function cancelScheduled(): Promise<void> {
  const ids = scheduledIds;
  scheduledIds = [];
  if (ids.length === 0) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* ignore */
  }
}

/**
 * At launch: drop alerts left over from a previous run of the app (killed by
 * the OS or swiped away mid-workout) and any delivered ones still on screen.
 */
export function clearStaleBackgroundCues(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  return enqueue(async () => {
    try {
      const { notifications } = await LocalNotifications.getPending();
      const ours = notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + ID_SPAN);
      if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    } catch {
      /* ignore */
    }
    await clearDelivered();
  });
}

/** Remove delivered cue notifications from the notification centre (they are stale once the app is open). */
export function clearDelivered(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  return (async () => {
    try {
      const { notifications } = await LocalNotifications.getDeliveredNotifications();
      const ours = notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + ID_SPAN);
      if (ours.length) await LocalNotifications.removeDeliveredNotifications({ notifications: ours });
    } catch {
      /* ignore */
    }
  })();
}

/** Test hook. */
export function __resetBackgroundForTests(): void {
  armed = false;
  generation = 0;
  scheduledIds = [];
  chain = Promise.resolve();
  prepared = null;
}
