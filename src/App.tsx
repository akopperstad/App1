import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavContext, type Nav, type Route } from './nav';
import { useSettings } from './state/store';
import { Home } from './screens/Home';
import { Configure } from './screens/Configure';
import { Run } from './screens/Run';
import { History } from './screens/History';
import { SettingsScreen } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';
import { useShareLinks, withLaunchImport } from './features/shareActions';
import { useNativeDeepLinks } from './native/useDeepLinks';
import { Toaster } from './features/toast';
import { useDocumentLang } from './i18n';

/**
 * Screen stack synced with browser history so the hardware / browser back
 * button behaves naturally (important on Android and in installed PWAs).
 */
const ROUTES = new Set(['home', 'configure', 'run', 'history', 'settings', 'onboarding']);

/** Each history entry carries the whole screen stack so reload / forward restore it. */
interface NavState {
  depth: number;
  stack: Route[];
}

function readState(state: unknown): NavState | null {
  const s = state as Partial<NavState> | null;
  if (!s || !Array.isArray(s.stack) || typeof s.depth !== 'number') return null;
  if (s.stack.length !== s.depth + 1 || s.stack[0]?.name !== 'home') return null;
  if (!s.stack.every((r) => r && ROUTES.has(r.name))) return null;
  return { depth: s.depth, stack: s.stack };
}

/**
 * Screen stack synced with browser history so the hardware / browser back
 * button behaves naturally (important on Android and in installed PWAs).
 * The stack is mirrored into history.state, so a reload keeps you on the same
 * screen and back / forward keep working one screen per press.
 */
export function App() {
  const [stack, setStack] = useState<Route[]>(() => withLaunchImport(readState(history.state)?.stack ?? [{ name: 'home' }]));
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    const cur = stackRef.current;
    history.replaceState({ depth: cur.length - 1, stack: cur } satisfies NavState, '');
    const onPop = (e: PopStateEvent) => {
      const st = readState(e.state);
      const next = st ? st.stack : stackRef.current.slice(0, 1);
      stackRef.current = next;
      setStack(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((route: Route) => {
    // Side effect kept outside the state updater: StrictMode runs updaters twice.
    const next = [...stackRef.current, route];
    stackRef.current = next;
    history.pushState({ depth: next.length - 1, stack: next } satisfies NavState, '');
    setStack(next);
  }, []);

  const replace = useCallback((route: Route) => {
    const next = [...stackRef.current.slice(0, -1), route];
    stackRef.current = next;
    history.replaceState({ depth: next.length - 1, stack: next } satisfies NavState, '');
    setStack(next);
  }, []);

  const back = useCallback(() => {
    if (stackRef.current.length > 1) history.back();
  }, []);

  const route = stack[stack.length - 1];
  const nav: Nav = useMemo(() => ({ route, go, replace, back }), [route, go, replace, back]);

  useTheme();
  useDocumentLang();
  useShareLinks(go);
  useNativeDeepLinks(go); // native app: appUrlOpen / launch URL → openShared
  const { onboarded } = useSettings();

  return (
    <NavContext.Provider value={nav}>
      {onboarded || route.name === 'onboarding' ? <Screen route={route} depth={stack.length} /> : <Onboarding />}
      <Toaster />
    </NavContext.Provider>
  );
}

function Screen({ route, depth }: { route: Route; depth: number }) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'configure':
      return <Configure key={depth} mode={route.mode} initial={route.initial} />;
    case 'run':
      return <Run key={depth} config={route.config} />;
    case 'history':
      return <History />;
    case 'settings':
      return <SettingsScreen />;
    case 'onboarding':
      return <OnboardingRoute />;
  }
}

/** Intro replayed from Settings: finishing returns to the previous screen. */
function OnboardingRoute() {
  const nav = useContext(NavContext);
  return <Onboarding onFinish={() => nav?.back()} />;
}

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      root.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'light' ? '#f6f6f4' : '#0a0b0d');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
