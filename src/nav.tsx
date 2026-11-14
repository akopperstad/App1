import { createContext, useContext } from 'react';
import type { Mode, WorkoutConfig } from './engine/types';

export type Route =
  | { name: 'home' }
  | { name: 'configure'; mode: Mode; initial?: WorkoutConfig; /** Opened from a share link. */ imported?: boolean }
  | { name: 'run'; config: WorkoutConfig }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'onboarding' };

export interface Nav {
  route: Route;
  /** Push a new screen (browser/Android back returns to the previous one). */
  go: (route: Route) => void;
  /** Replace the current screen without adding history. */
  replace: (route: Route) => void;
  back: () => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav outside NavContext');
  return nav;
}

/**
 * Optional veto for the browser / Android back button (popstate). The Run
 * screen sets it while a workout is active: instead of silently abandoning
 * the workout, back opens the "Leave workout?" sheet. Return true when the
 * back press was handled (the screen stays).
 */
export const backGuard: { current: (() => boolean) | null } = { current: null };
