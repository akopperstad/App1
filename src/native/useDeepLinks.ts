import { useEffect } from 'react';
import { openShared } from '../features/shareActions';
import type { Route } from '../nav';
import { onDeepLink } from './app';

/** Native app: open shared-workout links (https share URLs / pulse:// scheme) in the running app. */
export function useNativeDeepLinks(go: (r: Route) => void): void {
  useEffect(() => onDeepLink((url) => openShared(go, url)), [go]);
}
