import { useEffect } from 'react';
import { openShared } from '../features/shareActions';
import type { Route } from '../nav';
import { onDeepLink } from './app';
import { normalizeDeepLink } from './deepLinks';

/**
 * Native app: open shared-workout links (pulsetimer://import?w=… / #w=…, and
 * https share URLs via Universal Links / App Links) in the running app.
 */
export function useNativeDeepLinks(go: (r: Route) => void): void {
  useEffect(
    () =>
      onDeepLink((url) => {
        const link = normalizeDeepLink(url);
        return link ? openShared(go, link) : false;
      }),
    [go],
  );
}
