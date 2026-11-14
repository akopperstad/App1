import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeWorkout, parseShared, shareUrl } from '../features/share';
import { defaultSettings, settingsStore } from '../state/store';
import { __resetAudioSessionForTests } from './audioSession';
import { initPlatform } from './bootstrap';
import { APP_SCHEME, appLink, normalizeDeepLink } from './deepLinks';
import { __resetSystemUiForTests, setStatusBarOverride, setSystemBarsTheme, useStatusBarOverride } from './systemUi';
import { useNativeDeepLinks } from './useDeepLinks';

// ------------------------------------------------------------------ mocks

const env = vi.hoisted(() => ({ native: false, platform: 'web' as 'web' | 'ios' | 'android' }));
vi.mock('./platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./platform')>()),
  isNative: () => env.native,
  platform: () => env.platform,
}));

const core = vi.hoisted(() => ({
  configure: vi.fn(async (_o: { mixWithOthers: boolean }) => {}),
  barsStyle: vi.fn(async (_o: { style: string; bar?: string }) => {}),
}));
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  registerPlugin: () => ({ configure: core.configure }),
  SystemBars: { setStyle: core.barsStyle },
  SystemBarsStyle: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' },
  SystemBarType: { StatusBar: 'StatusBar', NavigationBar: 'NavigationBar' },
}));

const statusBar = vi.hoisted(() => ({ setStyle: vi.fn(async (_o: { style: string }) => {}) }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: statusBar, Style: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn(async () => {}) } }));

const app = vi.hoisted(() => ({
  launch: undefined as string | undefined,
  listeners: new Map<string, (arg?: unknown) => void>(),
  minimizeApp: vi.fn(async () => {}),
  getLaunchUrl: vi.fn(async () => (app.launch ? { url: app.launch } : undefined)),
  addListener: vi.fn(async (ev: string, fn: (arg?: unknown) => void) => {
    app.listeners.set(ev, fn);
    return { remove: async () => void app.listeners.delete(ev) };
  }),
}));
vi.mock('@capacitor/app', () => ({ App: app }));

// openShared stand-in: same contract (parseShared → go), without toasts / i18n.
vi.mock('../features/shareActions', async () => {
  const { parseShared: parse } = await import('../features/share');
  return {
    openShared: (go: (r: unknown) => void, input: string) => {
      const config = parse(input);
      if (!config) return false;
      go({ name: 'import', config });
      return true;
    },
  };
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

beforeEach(() => {
  env.native = false;
  env.platform = 'web';
  app.launch = undefined;
  app.listeners.clear();
  vi.clearAllMocks();
  __resetSystemUiForTests();
  __resetAudioSessionForTests();
  settingsStore.set({ ...defaultSettings });
});
afterEach(() => cleanup());

const goNative = (p: 'ios' | 'android') => {
  env.native = true;
  env.platform = p;
};

// ------------------------------------------------------------------ deep links

const config = { mode: 'tabata', workSec: 30, restSec: 15, rounds: 6, sets: 1, restBetweenSetsSec: 60, movements: [], name: 'Blåbær 30/15' } as const;
const code = encodeWorkout(config as never);

describe('normalizeDeepLink', () => {
  it.each([
    [`pulsetimer://import#w=${code}`],
    [`pulsetimer://import?w=${code}`],
    [`pulsetimer://import/?w=${code}`],
    [`PulseTimer://IMPORT?w=${code}`],
    [`pulsetimer:import?w=${code}`],
    [`pulsetimer://import?w=${encodeURIComponent(code).replace(/\./g, '%2E')}`],
    [`pulsetimer://import?w=${encodeURIComponent(encodeURIComponent(code).replace(/\./g, '%2E'))}`],
    [`pulsetimer://import?utm=x&w=${code}#`],
    [`https://pulse.example.com/w/#w=${code}`],
    [`https://pulse.example.com/w/?w=${code}`],
    [`https://pulse.example.com/?ref=1#w=${code}&x=1`],
  ])('%s → #w=<code>', (url) => {
    expect(normalizeDeepLink(url)).toBe(`#w=${code}`);
    expect(parseShared(normalizeDeepLink(url))).toMatchObject({ mode: 'tabata', workSec: 30, name: 'Blåbær 30/15' });
  });

  it('prefers the fragment over the query', () => {
    expect(normalizeDeepLink(`pulsetimer://import?w=1.AAA#w=${code}`)).toBe(`#w=${code}`);
  });

  it.each([
    [''],
    ['not a url'],
    ['pulsetimer://import'],
    ['pulsetimer://import?x=1'],
    [`pulsetimer://settings?w=${code}`],
    [`pulse://import?w=${code}`],
    [`javascript:alert(1)//?w=${code}`],
    [`file:///w/?w=${code}`],
    ['pulsetimer://import?w=<script>'],
    ['pulsetimer://import?w=%E0%A4%A'],
    ['https://pulse.example.com/'],
  ])('ignores %s', (url) => {
    expect(normalizeDeepLink(url)).toBeNull();
  });

  it('appLink() builds the query form the landing page uses', () => {
    expect(appLink(code)).toBe(`${APP_SCHEME}://import?w=${code}`);
    expect(normalizeDeepLink(appLink(code))).toBe(`#w=${code}`);
  });

  it('accepts what shareUrl() produces', () => {
    expect(normalizeDeepLink(shareUrl(config as never, 'https://pulse.example.com/w/'))).toBe(`#w=${code}`);
  });
});

describe('useNativeDeepLinks', () => {
  it('imports from the launch URL and later appUrlOpen events, ignores junk', async () => {
    goNative('android');
    app.launch = `pulsetimer://import?w=${code}`;
    const go = vi.fn();
    const { unmount } = renderHook(() => useNativeDeepLinks(go));
    await flush();
    expect(go).toHaveBeenCalledTimes(1);
    expect(go.mock.calls[0][0]).toMatchObject({ config: { mode: 'tabata', rounds: 6 } });

    app.listeners.get('appUrlOpen')!({ url: 'pulsetimer://import?w=garbage' });
    app.listeners.get('appUrlOpen')!({ url: 'https://example.com/unrelated' });
    expect(go).toHaveBeenCalledTimes(1);

    const other = encodeWorkout({ mode: 'countdown', durationSec: 90 } as never);
    app.listeners.get('appUrlOpen')!({ url: `pulsetimer://import#w=${other}` });
    expect(go).toHaveBeenCalledTimes(2);
    expect(go.mock.calls[1][0]).toMatchObject({ config: { mode: 'countdown', durationSec: 90 } });
    unmount();
  });
});

// ------------------------------------------------------------------ system bars

describe('status / navigation bar', () => {
  it('follows the theme, and an override wins until cleared', () => {
    goNative('android');
    setSystemBarsTheme('light');
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' }); // dark icons
    expect(core.barsStyle).toHaveBeenLastCalledWith({ style: 'LIGHT', bar: 'NavigationBar' });

    setStatusBarOverride('light'); // Run screen filled with the phase colour
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' }); // white icons
    expect(core.barsStyle).toHaveBeenLastCalledWith({ style: 'DARK', bar: 'NavigationBar' });

    setSystemBarsTheme('light'); // theme changes do not undo the override
    setSystemBarsTheme('dark');
    expect(statusBar.setStyle).toHaveBeenCalledTimes(2);

    setStatusBarOverride(null); // back to the (now dark) theme: white icons, already applied
    expect(statusBar.setStyle).toHaveBeenCalledTimes(2);
    setSystemBarsTheme('light');
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
  });

  it('useStatusBarOverride restores the theme on unmount; iOS leaves the nav bar alone', () => {
    goNative('ios');
    setSystemBarsTheme('light');
    const { rerender, unmount } = renderHook(({ v }) => useStatusBarOverride(v), { initialProps: { v: 'light' as 'light' | null } });
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });
    rerender({ v: null });
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
    rerender({ v: 'light' });
    unmount();
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
    expect(core.barsStyle).not.toHaveBeenCalled();
  });

  it('is a no-op on the web', () => {
    setStatusBarOverride('light');
    setSystemBarsTheme('light');
    expect(statusBar.setStyle).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ settings reactivity

describe('audio session follows settings live', () => {
  it('iOS: re-configures the native session whenever "Play over music" changes', () => {
    goNative('ios');
    initPlatform();
    expect(core.configure).toHaveBeenLastCalledWith({ mixWithOthers: true });
    settingsStore.set({ ...settingsStore.get(), mixWithMusic: false });
    expect(core.configure).toHaveBeenLastCalledWith({ mixWithOthers: false });
    settingsStore.set({ ...settingsStore.get(), volume: 0.3 }); // unrelated change: no call
    expect(core.configure).toHaveBeenCalledTimes(2);
    settingsStore.set({ ...settingsStore.get(), mixWithMusic: true });
    expect(core.configure).toHaveBeenLastCalledWith({ mixWithOthers: true });
  });

  it('web: toggles navigator.audioSession.type (iOS Safari 16.4+)', () => {
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    __resetAudioSessionForTests(); // earlier tests' subscriptions already ran on the beforeEach reset
    initPlatform();
    expect(session.type).toBe('ambient');
    settingsStore.set({ ...settingsStore.get(), mixWithMusic: false });
    expect(session.type).toBe('auto');
    expect(core.configure).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'audioSession');
  });
});
