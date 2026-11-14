import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavContext, type Nav } from '../nav';
import { Configure } from '../screens/Configure';
import { History } from '../screens/History';
import { defaultSettings, historyStore, settingsStore } from '../state/store';
import { WIDE_QUERY, useWide } from './useMediaQuery';

/** A controllable matchMedia: `wide.matches` drives every query. */
const wide = { matches: false, listeners: new Set<() => void>() };
function installMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return wide.matches;
    },
    addEventListener: (_: string, l: () => void) => wide.listeners.add(l),
    removeEventListener: (_: string, l: () => void) => wide.listeners.delete(l),
  }));
}
const setWide = (v: boolean) =>
  act(() => {
    wide.matches = v;
    for (const l of [...wide.listeners]) l();
  });

const nav: Nav = { route: { name: 'home' }, go: vi.fn(), replace: vi.fn(), back: vi.fn() };
const withNav = (ui: React.ReactNode) => render(<NavContext.Provider value={nav}>{ui}</NavContext.Provider>);

beforeEach(() => {
  wide.matches = false;
  wide.listeners.clear();
  installMatchMedia();
  settingsStore.set({ ...defaultSettings, onboarded: true, language: 'en' });
  const amrap = { mode: 'amrap' as const, durationSec: 600, sets: 1, restBetweenSetsSec: 0, name: 'Cindy' };
  historyStore.set([
    { id: 'a', name: 'Cindy', mode: 'amrap', config: amrap, startedAt: Date.now() - 3_600_000, durationMs: 600_000, completed: true, rounds: 6, roundTimesMs: [], laps: [] },
  ]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useWide', () => {
  it('excludes phones in landscape (needs height too) and follows changes', () => {
    expect(WIDE_QUERY).toContain('min-width: 768px');
    expect(WIDE_QUERY).toContain('min-height: 500px');
    const { result } = renderHook(() => useWide());
    expect(result.current).toBe(false);
    setWide(true);
    expect(result.current).toBe(true);
  });

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useWide());
    expect(result.current).toBe(false);
  });
});

describe('tablet layouts', () => {
  it('History: stats, chart and records move into a side column next to the list', () => {
    const { container } = withNav(<History />);
    expect(container.querySelector('.hist__side')).toBeNull();
    setWide(true);
    const side = container.querySelector('.hist__side');
    expect(side?.querySelector('.hist-stats')).toBeTruthy();
    expect(side?.querySelector('.hist-chart')).toBeTruthy();
    expect(side?.querySelector('.hist-records')).toBeTruthy();
    expect(container.querySelector('.hist__main .hist-group')).toBeTruthy();
  });

  it('Configure: Save / Start sit under the summary in the side pane (phones: bottom bar)', () => {
    const { container } = withNav(<Configure mode="tabata" />);
    expect(container.querySelector('.cfg__side .cfg-bar')).toBeNull();
    expect(container.querySelector('.cfg-bar')).toBeTruthy();
    setWide(true);
    expect(container.querySelector('.cfg__side .cfg-summary + .cfg-bar')).toBeTruthy();
    expect(container.querySelectorAll('.cfg-bar')).toHaveLength(1);
  });
});
