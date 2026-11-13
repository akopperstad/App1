import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavContext, type Nav, type Route } from './nav';
import { useSettings } from './state/store';
import { Home } from './screens/Home';
import { Configure } from './screens/Configure';
import { Run } from './screens/Run';
import { History } from './screens/History';
import { SettingsScreen } from './screens/Settings';

/**
 * Screen stack synced with browser history so the hardware / browser back
 * button behaves naturally (important on Android and in installed PWAs).
 */
export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    history.replaceState({ depth: 0 }, '');
    const onPop = (e: PopStateEvent) => {
      const depth = typeof e.state?.depth === 'number' ? e.state.depth : 0;
      setStack((s) => s.slice(0, Math.max(1, depth + 1)));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((route: Route) => {
    // Side effect kept outside the state updater: StrictMode runs updaters twice.
    const next = [...stackRef.current, route];
    stackRef.current = next;
    history.pushState({ depth: next.length - 1 }, '');
    setStack(next);
  }, []);

  const replace = useCallback((route: Route) => {
    const next = [...stackRef.current.slice(0, -1), route];
    stackRef.current = next;
    setStack(next);
  }, []);

  const back = useCallback(() => {
    if (stackRef.current.length > 1) history.back();
  }, []);

  const route = stack[stack.length - 1];
  const nav: Nav = useMemo(() => ({ route, go, replace, back }), [route, go, replace, back]);

  useTheme();

  return (
    <NavContext.Provider value={nav}>
      <Screen route={route} depth={stack.length} />
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
  }
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
