import { App } from '@capacitor/app';
import { isNative, quietly } from './platform';

/**
 * App lifecycle + Android back button (native only; every function is a
 * harmless no-op on the web, where visibilitychange / popstate already do the job).
 */

type Unsub = () => void;

function listen(add: () => Promise<{ remove: () => Promise<void> }>): Unsub {
  let removed = false;
  let handle: { remove: () => Promise<void> } | null = null;
  try {
    add()
      .then((h) => {
        if (removed) quietly(() => h.remove());
        else handle = h;
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }
  return () => {
    removed = true;
    if (handle) quietly(() => handle!.remove());
    handle = null;
  };
}

/**
 * Foreground / background changes. `active` is false as soon as the app is
 * about to leave the foreground (home, app switcher, screen lock, incoming call).
 */
export function onAppActiveChange(fn: (active: boolean) => void): Unsub {
  if (!isNative()) return () => {};
  return listen(() => App.addListener('appStateChange', (s) => fn(s.isActive)));
}

/** The app came back to the foreground. */
export function onAppResume(fn: () => void): Unsub {
  if (!isNative()) return () => {};
  return listen(() => App.addListener('resume', fn));
}

/** Depth of the in-app screen stack (App.tsx mirrors it into history.state). */
function navDepth(): number {
  try {
    const d = (history.state as { depth?: unknown } | null)?.depth;
    return typeof d === 'number' && d > 0 ? d : 0;
  } catch {
    return 0;
  }
}

/**
 * Android hardware/gesture back: go back one screen when there is one
 * (same path as the browser back button, so screens behave exactly like the
 * PWA), otherwise send the app to the background instead of killing it.
 */
export function installBackButton(): Unsub {
  if (!isNative()) return () => {};
  return listen(() =>
    App.addListener('backButton', () => {
      if (navDepth() > 0) history.back();
      else quietly(() => App.minimizeApp());
    }),
  );
}
