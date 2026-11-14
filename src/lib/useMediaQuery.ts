import { useSyncExternalStore } from 'react';

/**
 * Tablet / wide layouts (iPad, Android tablets, desktop). Phones stay below this in
 * both orientations (a phone in landscape is wide but never 500px tall).
 * Keep in sync with the `(min-width: 768px) and (min-height: 500px)` media
 * queries in the screen stylesheets.
 */
export const WIDE_QUERY = '(min-width: 768px) and (min-height: 500px)';

function mql(query: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  } catch {
    return null;
  }
}

/** Live boolean for a CSS media query. False where matchMedia is unavailable (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = mql(query);
      if (!m || typeof m.addEventListener !== 'function') return () => {};
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => !!mql(query)?.matches,
    () => false,
  );
}

/** True on tablet-width screens, where screens switch to their multi-column layouts. */
export function useWide(): boolean {
  return useMediaQuery(WIDE_QUERY);
}
