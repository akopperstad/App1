import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cuePlayer } from '../audio/cues';
import type { WorkoutConfig } from '../engine/types';
import { NavContext, type Nav } from '../nav';
import { historyStore, settingsStore, defaultSettings } from '../state/store';
import { Run } from './Run';

function nav(): Nav {
  return { route: { name: 'home' }, go: vi.fn(), replace: vi.fn(), back: vi.fn() };
}

function mount(config: WorkoutConfig, prepSec = 0) {
  settingsStore.set({ ...defaultSettings, prepSec, voice: false, sound: false, vibration: false });
  const n = nav();
  const utils = render(
    <StrictMode>
      <NavContext.Provider value={n}>
        <Run config={config} />
      </NavContext.Provider>
    </StrictMode>,
  );
  return { ...utils, nav: n };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const key = (k: string, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, { key: k });
    fireEvent.keyUp(target, { key: k });
  });

const start = () => act(() => fireEvent.click(screen.getByRole('button', { name: /start/i })));

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  historyStore.set([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Run screen', () => {
  it('StrictMode: one engine, cues delivered once, one history entry on unmount, silent afterwards', () => {
    const handle = vi.spyOn(cuePlayer, 'handle');
    const stop = vi.spyOn(cuePlayer, 'stop');
    const unlock = vi.spyOn(cuePlayer, 'unlock');
    const { unmount } = mount({ mode: 'countdown', durationSec: 60 });
    start();
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls.filter(([c]) => c.type === 'start')).toHaveLength(1);
    advance(55_020);
    expect(handle.mock.calls.filter(([c]) => c.type === 'tenSeconds')).toHaveLength(1);
    expect(screen.getByRole('timer').textContent).toContain('0:05');
    handle.mockClear();
    unmount();
    expect(historyStore.get()).toHaveLength(1);
    expect(historyStore.get()[0]).toMatchObject({ completed: false, mode: 'countdown' });
    expect(Math.round(historyStore.get()[0].durationMs / 1000)).toBe(55);
    // No click on the way out, nothing after: the countdown end must not fire.
    advance(30_000);
    expect(handle).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('natural finish saves once; Repeat starts a new session with a new startedAt', () => {
    mount({ mode: 'countdown', durationSec: 10 });
    start();
    const firstStart = Date.now();
    advance(12_000);
    expect(historyStore.get()).toHaveLength(1);
    expect(historyStore.get()[0]).toMatchObject({ completed: true, durationMs: 10_000, startedAt: firstStart });
    advance(5_000);
    act(() => fireEvent.click(screen.getByRole('button', { name: /repeat/i })));
    const secondStart = Date.now();
    expect(secondStart).toBeGreaterThan(firstStart);
    advance(12_000);
    const h = historyStore.get();
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ completed: true, startedAt: secondStart, durationMs: 10_000 });
    expect(h[1].startedAt).toBe(firstStart);
  });

  it('hiding the page checkpoints the session; the final result updates that same entry', () => {
    mount({ mode: 'countdown', durationSec: 30 });
    start();
    advance(10_000);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(historyStore.get()).toHaveLength(1);
    expect(historyStore.get()[0].completed).toBe(false);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    advance(25_000);
    expect(historyStore.get()).toHaveLength(1);
    expect(historyStore.get()[0]).toMatchObject({ completed: true, durationMs: 30_000 });
  });

  it('keyboard: → does not end a stopwatch, ← does not restart it; → skips get ready', () => {
    mount({ mode: 'stopwatch' }, 5);
    key(' ');
    advance(1_000);
    key('ArrowRight'); // skip prep
    advance(20_000);
    key('ArrowRight');
    key('ArrowLeft');
    advance(1_000);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Elapsed 0:21');
    expect(historyStore.get()).toHaveLength(0);
  });

  it('keyboard: Space on a focused button toggles exactly once', () => {
    mount({ mode: 'countdown', durationSec: 60 });
    start();
    advance(2_000);
    const play = screen.getByRole('button', { name: 'Pause' });
    play.focus();
    act(() => {
      const down = fireEvent.keyDown(play, { key: ' ' });
      const up = fireEvent.keyUp(play, { key: ' ' });
      // Both default actions are cancelled, so the browser will not also click the button.
      expect(down).toBe(false);
      expect(up).toBe(false);
    });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  it('keyboard: Space is ignored while a sheet is open and on the finish summary', () => {
    mount({ mode: 'countdown', durationSec: 10 });
    start();
    advance(2_000);
    key('Escape'); // opens "Leave workout?"
    expect(screen.getByRole('dialog')).toBeTruthy();
    key(' ', screen.getByRole('dialog'));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Keep going' })));
    advance(10_000);
    expect(screen.getByRole('button', { name: /repeat/i })).toBeTruthy();
    key(' ');
    // Still on the summary: Space did not silently start a new session.
    expect(screen.getByRole('button', { name: /repeat/i })).toBeTruthy();
    expect(historyStore.get()).toHaveLength(1);
  });

  it('Remaining stays consistent after going back a segment', () => {
    mount({ mode: 'interval', workSec: 20, restSec: 10, rounds: 2, sets: 1, restBetweenSetsSec: 0, movements: [] });
    start();
    advance(25_020); // 5s into rest; plan: 20 + 10 + 20 = 50
    const remaining = () => screen.getByText('Remaining').nextElementSibling!.textContent;
    expect(remaining()).toBe('0:25');
    key('ArrowLeft'); // restart rest
    expect(remaining()).toBe('0:30');
  });

  it('a malformed config from storage renders instead of crashing', () => {
    mount({ mode: 'emom', intervalSec: 60, rounds: 3 } as unknown as WorkoutConfig);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
    start();
    advance(1_000);
    expect(screen.getByRole('timer')).toBeTruthy();
  });
});
