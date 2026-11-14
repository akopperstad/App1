import { Capacitor } from '@capacitor/core';

/**
 * Where the app is running. The web build (PWA) and the Capacitor iOS /
 * Android apps share one bundle; anything native-only must check this first
 * and fall back to the web behaviour.
 */
export type Platform = 'web' | 'ios' | 'android';

export function platform(): Platform {
  try {
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
}

/** True inside the iOS / Android app (Capacitor native runtime). */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Run a native call without ever letting it throw or reject into the caller. */
export function quietly(fn: () => unknown): void {
  try {
    const p = fn() as Promise<unknown> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}
