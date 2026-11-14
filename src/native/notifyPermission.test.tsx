import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavContext, type Nav } from '../nav';
import { SettingsScreen } from '../screens/Settings';
import { defaultSettings, settingsStore } from '../state/store';
import {
  __resetBackgroundForTests,
  armBackgroundCues,
  notificationPermission,
  prepareBackgroundCues,
  refreshNotificationPermission,
  subscribeNotificationPermission,
  useNotificationPermission,
} from './background';

const env = vi.hoisted(() => ({ native: false, platform: 'web' as 'web' | 'ios' | 'android' }));
vi.mock('./platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./platform')>()),
  isNative: () => env.native,
  platform: () => env.platform,
}));

const ln = vi.hoisted(() => ({
  perm: 'prompt' as string,
  answer: 'granted' as string,
  createChannel: vi.fn(async () => {}),
  checkPermissions: vi.fn(async () => ({ display: ln.perm })),
  requestPermissions: vi.fn(async () => ({ display: (ln.perm = ln.answer) })),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'granted' })),
  schedule: vi.fn(async () => ({ notifications: [] })),
  cancel: vi.fn(async () => {}),
  getPending: vi.fn(async () => ({ notifications: [] })),
  getDeliveredNotifications: vi.fn(async () => ({ notifications: [] })),
  removeDeliveredNotifications: vi.fn(async () => {}),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

const DENIED_NOTE = 'Notifications are off for Pulse — enable them in system Settings';

function renderSettings() {
  const nav: Nav = { route: { name: 'settings' }, go: vi.fn(), replace: vi.fn(), back: vi.fn() };
  return render(
    <NavContext.Provider value={nav}>
      <SettingsScreen />
    </NavContext.Provider>,
  );
}

beforeEach(() => {
  env.native = false;
  env.platform = 'web';
  ln.perm = 'prompt';
  ln.answer = 'granted';
  __resetBackgroundForTests();
  vi.clearAllMocks();
  settingsStore.set({ ...defaultSettings, onboarded: true, language: 'en', backgroundAlerts: true });
});
afterEach(() => cleanup());

describe('notification permission state', () => {
  it('is unknown on the web and never touches the plugin', async () => {
    expect(await refreshNotificationPermission()).toBe('unknown');
    expect(ln.checkPermissions).not.toHaveBeenCalled();
  });

  it('tracks the answer to the first-start prompt and notifies subscribers', async () => {
    env.native = true;
    env.platform = 'ios';
    ln.answer = 'denied';
    const seen: string[] = [];
    const off = subscribeNotificationPermission(() => seen.push(notificationPermission()));
    expect(await prepareBackgroundCues()).toBe(false);
    expect(notificationPermission()).toBe('denied');
    expect(seen).toEqual(['denied']);
    off();
  });

  it('updates from the background-arm check and from an explicit refresh (user changed system Settings)', async () => {
    env.native = true;
    env.platform = 'android';
    ln.perm = 'denied';
    await armBackgroundCues([{ atMs: 5_000, title: 'Rest', body: '0:10', kind: 'rest', segmentIndex: 2 }]);
    expect(notificationPermission()).toBe('denied');
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current).toBe('denied');
    ln.perm = 'granted';
    await act(async () => {
      await refreshNotificationPermission();
    });
    expect(result.current).toBe('granted');
    expect(ln.requestPermissions).not.toHaveBeenCalled();
  });
});

describe('Settings › Alerts when locked', () => {
  it('shows a note when the OS has notifications off, and hides it once they are back on', async () => {
    env.native = true;
    env.platform = 'ios';
    ln.perm = 'denied';
    renderSettings();
    await flush();
    expect(screen.getByText('Alerts when locked')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toBe(DENIED_NOTE);
    expect(ln.requestPermissions).not.toHaveBeenCalled();

    // Back from the system Settings app with notifications allowed.
    ln.perm = 'granted';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows no note while background alerts are switched off, or with permission granted', async () => {
    env.native = true;
    env.platform = 'android';
    ln.perm = 'denied';
    settingsStore.set({ ...settingsStore.get(), backgroundAlerts: false });
    renderSettings();
    await flush();
    expect(screen.queryByText(DENIED_NOTE)).toBeNull();
    cleanup();

    ln.perm = 'granted';
    settingsStore.set({ ...settingsStore.get(), backgroundAlerts: true });
    renderSettings();
    await flush();
    expect(screen.queryByText(DENIED_NOTE)).toBeNull();
  });

  it('is absent on the web (no native row at all)', async () => {
    renderSettings();
    await flush();
    expect(screen.queryByText('Alerts when locked')).toBeNull();
    expect(screen.queryByText(DENIED_NOTE)).toBeNull();
  });
});
