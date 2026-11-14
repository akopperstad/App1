import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cuePlayer } from '../audio/cues';
import { primeSpeech, say, stopSpeech } from '../audio/speech';
import { compile } from '../engine/compile';
import { TimerEngine } from '../engine/engine';
import type { Segment } from '../engine/types';
import { useWakeLock } from '../lib/wakeLock';
import { defaultSettings, settingsStore } from '../state/store';
import {
  BASE_ID,
  CUE_CHANNEL_ID,
  __resetBackgroundForTests,
  armBackgroundCues,
  backgroundCuesArmed,
  disarmBackgroundCues,
  prepareBackgroundCues,
  toNotifications,
} from './background';
import { installBackButton, onDeepLink } from './app';
import { planAlerts } from './schedule';
import { useBackgroundCues } from './useBackgroundCues';

// ------------------------------------------------------------------ mocks

const env = vi.hoisted(() => ({ native: false, platform: 'web' as 'web' | 'ios' | 'android' }));

vi.mock('./platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./platform')>()),
  isNative: () => env.native,
  platform: () => env.platform,
}));

const keepAwake = vi.hoisted(() => ({ keepAwake: vi.fn(async () => {}), allowSleep: vi.fn(async () => {}) }));
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: keepAwake }));

const tts = vi.hoisted(() => ({ speak: vi.fn(async () => {}), stop: vi.fn(async () => {}) }));
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: tts, QueueStrategy: { Flush: 0, Add: 1 } }));

const haptics = vi.hoisted(() => ({ impact: vi.fn(async () => {}), notification: vi.fn(async () => {}) }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: haptics,
  ImpactStyle: { Heavy: 'HEAVY', Medium: 'MEDIUM', Light: 'LIGHT' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

const ln = vi.hoisted(() => ({
  perm: 'prompt' as string,
  exact: 'granted' as string,
  createChannel: vi.fn(async () => {}),
  checkPermissions: vi.fn(async () => ({ display: ln.perm })),
  requestPermissions: vi.fn(async () => ({ display: (ln.perm = 'granted') })),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: ln.exact })),
  schedule: vi.fn(async (_o: { notifications: { id: number; schedule?: { at?: Date } }[] }) => ({ notifications: [] })),
  cancel: vi.fn(async (_o: { notifications: { id: number }[] }) => {}),
  getPending: vi.fn(async () => ({ notifications: [] })),
  getDeliveredNotifications: vi.fn(async () => ({ notifications: [] })),
  removeDeliveredNotifications: vi.fn(async () => {}),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));

const app = vi.hoisted(() => ({
  listeners: new Map<string, (arg?: unknown) => void>(),
  minimizeApp: vi.fn(async () => {}),
  getLaunchUrl: vi.fn(async () => ({ url: 'https://pulse.example/#w=launch' })),
  addListener: vi.fn(async (ev: string, fn: (arg?: unknown) => void) => {
    app.listeners.set(ev, fn);
    return { remove: async () => void app.listeners.delete(ev) };
  }),
}));
vi.mock('@capacitor/app', () => ({ App: app }));

const flush = () => act(async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
});

const workSeg: Segment = { kind: 'work', label: 'Work', durationMs: 20_000, direction: 'down', round: 2, totalRounds: 8 };

beforeEach(() => {
  env.native = false;
  env.platform = 'web';
  ln.perm = 'prompt';
  ln.exact = 'granted';
  __resetBackgroundForTests();
  vi.clearAllMocks();
  app.listeners.clear();
  settingsStore.set({ ...defaultSettings });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'vibrate');
});

function goNative(p: 'ios' | 'android' = 'ios') {
  env.native = true;
  env.platform = p;
}

// ------------------------------------------------------------------ web fallbacks

describe('web build (no native runtime)', () => {
  it('keeps the web code paths and never touches native plugins', async () => {
    renderHook(() => useWakeLock(true));
    say('Work');
    stopSpeech();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    cuePlayer.handle({ type: 'segment', segment: workSeg, index: 1, previous: workSeg }, { ...defaultSettings, sound: false });
    expect(await prepareBackgroundCues()).toBe(false);
    await armBackgroundCues([{ atMs: 1000, title: 't', body: '', kind: 'work', segmentIndex: 1 }]);
    installBackButton();
    await flush();

    expect(vibrate).toHaveBeenCalledWith([400, 90, 400]);
    expect(keepAwake.keepAwake).not.toHaveBeenCalled();
    expect(tts.speak).not.toHaveBeenCalled();
    expect(haptics.impact).not.toHaveBeenCalled();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(app.addListener).not.toHaveBeenCalled();
    expect(backgroundCuesArmed()).toBe(false);
  });
});

// ------------------------------------------------------------------ native plugins

describe('native app', () => {
  it('keeps the screen awake with the KeepAwake plugin', () => {
    goNative();
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    expect(keepAwake.keepAwake).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    expect(keepAwake.allowSleep).toHaveBeenCalledTimes(1);
  });

  it('speaks with native TTS (flush queue) and stops it', () => {
    goNative();
    primeSpeech();
    expect(tts.speak).not.toHaveBeenCalled();
    say('Round 2 of 8', 0.5);
    expect(tts.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Round 2 of 8', volume: 0.5, lang: 'en-US', queueStrategy: 0 }),
    );
    say('Pause', 1, 'nb-NO');
    expect(tts.speak).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Pause', lang: 'nb-NO' }));
    stopSpeech();
    expect(tts.stop).toHaveBeenCalled();
  });

  it('maps cues to native haptics instead of navigator.vibrate', () => {
    goNative();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const s = { ...defaultSettings, sound: false, voice: false };
    cuePlayer.handle({ type: 'finish' }, s);
    expect(haptics.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    cuePlayer.handle({ type: 'countdown', n: 2, segment: workSeg }, s);
    expect(haptics.impact).toHaveBeenCalledWith({ style: 'MEDIUM' });
    expect(vibrate).not.toHaveBeenCalled();
    haptics.impact.mockClear();
    cuePlayer.handle({ type: 'countdown', n: 2, segment: workSeg }, { ...s, vibration: false });
    expect(haptics.impact).not.toHaveBeenCalled();
  });

  it('Android back: one screen back when there is one, else minimise', async () => {
    goNative('android');
    installBackButton();
    await flush();
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    history.replaceState({ depth: 1, stack: [] }, '');
    app.listeners.get('backButton')!();
    expect(back).toHaveBeenCalledTimes(1);
    history.replaceState({ depth: 0, stack: [] }, '');
    app.listeners.get('backButton')!();
    expect(app.minimizeApp).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});

describe('native deep links', () => {
  it('opens the launch URL once and later appUrlOpen events', async () => {
    goNative('android');
    const open = vi.fn(() => true);
    const off = onDeepLink(open);
    const off2 = onDeepLink(open); // StrictMode double effect: launch URL still opened once
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('https://pulse.example/#w=launch');
    app.listeners.get('appUrlOpen')!({ url: 'https://pulse.example/#w=other' });
    expect(open).toHaveBeenLastCalledWith('https://pulse.example/#w=other');
    off();
    off2();
  });

  it('is inert on the web', async () => {
    const open = vi.fn(() => true);
    onDeepLink(open);
    await flush();
    expect(open).not.toHaveBeenCalled();
    expect(app.getLaunchUrl).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ background cues

describe('background cues', () => {
  const plan = planAlerts(
    compile({ mode: 'tabata', workSec: 20, restSec: 10, rounds: 2, sets: 1, restBetweenSetsSec: 0, movements: [] }, 0),
    0,
    5_000,
  );

  it('toNotifications assigns our id range and absolute times', () => {
    const n = toNotifications(plan, 1_000_000);
    expect(n.map((x) => x.id)).toEqual([BASE_ID, BASE_ID + 1, BASE_ID + 2]);
    expect(n[0].schedule?.at?.getTime()).toBe(1_015_000);
    expect(n[0]).toMatchObject({ title: 'Rest — 0:10', channelId: CUE_CHANNEL_ID, sound: 'pulse_cue.wav' });
    expect(n[2]).toMatchObject({ title: 'Time!', body: 'Workout complete' });
  });

  it('asks for permission once, creates the Android channel, arms, mutes in-app cues, disarms', async () => {
    goNative('android');
    expect(await prepareBackgroundCues()).toBe(true);
    expect(ln.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: CUE_CHANNEL_ID, name: 'Workout cues', importance: 5, vibration: true }));
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
    await prepareBackgroundCues();
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);

    await armBackgroundCues(plan);
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    const sent = ln.schedule.mock.calls[0][0].notifications;
    expect(sent).toHaveLength(3);
    expect(sent[0]).toMatchObject({ id: BASE_ID, isExactNotification: true });
    expect(backgroundCuesArmed()).toBe(true);

    cuePlayer.handle({ type: 'finish' }, defaultSettings);
    expect(haptics.notification).not.toHaveBeenCalled();

    await disarmBackgroundCues();
    expect(backgroundCuesArmed()).toBe(false);
    expect(ln.cancel).toHaveBeenLastCalledWith({ notifications: [{ id: BASE_ID }, { id: BASE_ID + 1 }, { id: BASE_ID + 2 }] });
  });

  it('never prompts while going to the background, and stays quiet without permission', async () => {
    goNative('ios');
    ln.perm = 'denied';
    await armBackgroundCues(plan);
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(backgroundCuesArmed()).toBe(false);
  });

  it('falls back to inexact alarms when Android denies exact ones (never opens Settings)', async () => {
    goNative('android');
    ln.perm = 'granted';
    ln.exact = 'denied';
    await armBackgroundCues(plan);
    expect(ln.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ isExactNotification: false });
  });

  it('a disarm issued before the arm finishes wins', async () => {
    goNative('ios');
    ln.perm = 'granted';
    const a = armBackgroundCues(plan);
    const d = disarmBackgroundCues();
    await Promise.all([a, d]);
    expect(ln.schedule).not.toHaveBeenCalled();
    expect(backgroundCuesArmed()).toBe(false);
  });

  it('Run hook: with background alerts off it never prompts or schedules; turning them on applies at the next arm', async () => {
    goNative('android');
    ln.perm = 'granted';
    settingsStore.set({ ...defaultSettings, backgroundAlerts: false });
    let t = 0;
    const engine = new TimerEngine(
      compile({ mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] }, 0),
      { now: () => t },
    );
    renderHook(() => useBackgroundCues(engine));
    await flush();
    act(() => engine.start());
    await flush();
    expect(ln.requestPermissions).not.toHaveBeenCalled();
    expect(ln.createChannel).not.toHaveBeenCalled();
    t = 1_000;
    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(ln.schedule).not.toHaveBeenCalled();

    // Read live from the settings store at arm time.
    act(() => app.listeners.get('appStateChange')!({ isActive: true }));
    settingsStore.set({ ...defaultSettings, backgroundAlerts: true });
    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(ln.schedule).toHaveBeenCalledTimes(1);
  });

  it('Run hook: arms on background while running, disarms on return / pause / unmount', async () => {
    goNative('ios');
    let t = 0;
    const engine = new TimerEngine(
      compile({ mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] }, 10),
      { now: () => t },
    );
    const { unmount } = renderHook(() => useBackgroundCues(engine));
    await flush();
    act(() => engine.start());
    await flush();
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1); // lazily, on first start

    t = 4_000;
    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    const sent = ln.schedule.mock.calls[0][0].notifications;
    expect(sent).toHaveLength(16);
    expect(backgroundCuesArmed()).toBe(true);

    act(() => app.listeners.get('appStateChange')!({ isActive: true }));
    await flush();
    expect(backgroundCuesArmed()).toBe(false);
    expect(ln.cancel).toHaveBeenCalled();

    // Background alerts off: nothing is scheduled.
    settingsStore.set({ ...defaultSettings, backgroundAlerts: false });
    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(ln.schedule).toHaveBeenCalledTimes(1);
    settingsStore.set({ ...defaultSettings });

    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(backgroundCuesArmed()).toBe(true);
    act(() => engine.pause());
    await flush();
    expect(backgroundCuesArmed()).toBe(false);

    act(() => engine.start());
    act(() => app.listeners.get('appStateChange')!({ isActive: false }));
    await flush();
    expect(backgroundCuesArmed()).toBe(true);
    unmount();
    await flush();
    expect(backgroundCuesArmed()).toBe(false);
    expect(app.listeners.has('appStateChange')).toBe(false);
  });
});
