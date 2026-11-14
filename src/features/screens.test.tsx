import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { NavContext, type Nav, type Route } from '../nav';
import { History } from '../screens/History';
import { Onboarding } from '../screens/Onboarding';
import { SettingsScreen } from '../screens/Settings';
import { defaultSettings, historyStore, presetsStore, settingsStore, type HistoryEntry } from '../state/store';
import { encodeWorkout } from './share';
import { ShareButton } from './shareActions';
import { Toaster } from './toast';

function withNav(ui: React.ReactNode, go = vi.fn()) {
  const nav: Nav = { route: { name: 'home' }, go, replace: vi.fn(), back: vi.fn() };
  return render(
    <NavContext.Provider value={nav}>
      {ui}
      <Toaster />
    </NavContext.Provider>,
  );
}

const amrap = { mode: 'amrap' as const, durationSec: 1200, sets: 1, restBetweenSetsSec: 0, name: 'Cindy' };
function entry(id: string, daysAgo: number, rounds: number): HistoryEntry {
  return {
    id,
    name: 'Cindy',
    mode: 'amrap',
    config: amrap,
    startedAt: Date.now() - daysAgo * 86_400_000,
    durationMs: 1_200_000,
    completed: true,
    rounds,
    roundTimesMs: [],
    laps: [],
  };
}

beforeEach(() => {
  settingsStore.set({ ...defaultSettings, onboarded: true, language: 'en' });
  historyStore.set([]);
  presetsStore.set([]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Settings', () => {
  it('picks a sound pack (radiogroup) and switches language', () => {
    withNav(<SettingsScreen />);
    const group = screen.getByRole('radiogroup', { name: 'Sound style' });
    const boxing = screen.getByRole('radio', { name: /Boxing bell/ });
    expect(group).toBeTruthy();
    fireEvent.click(boxing);
    expect(settingsStore.get().soundPack).toBe('boxing');
    expect(boxing.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(boxing, { key: 'ArrowDown' });
    expect(settingsStore.get().soundPack).toBe('whistle');

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'nb' } });
    expect(settingsStore.get().language).toBe('nb');
    expect(screen.getByRole('heading', { name: 'Innstillinger' })).toBeTruthy();
    expect(screen.getByText('Dine data')).toBeTruthy();
  });

  it('imports a pasted share code', async () => {
    const go = vi.fn();
    withNav(<SettingsScreen />, go);
    fireEvent.click(screen.getByText('Import a shared workout'));
    const input = await screen.findByLabelText('Link or code');
    fireEvent.change(input, { target: { value: 'garbage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('alert').textContent).toMatch(/isn’t a valid workout/);
    fireEvent.change(input, { target: { value: `https://x.test/#w=${encodeWorkout(amrap)}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ name: 'configure', mode: 'amrap', imported: true }));
  });

  it('confirms a restore with a merge summary', async () => {
    withNav(<SettingsScreen />);
    const backup = {
      app: 'pulse-timer',
      version: 1,
      exportedAt: Date.now(),
      settings: { ...defaultSettings, volume: 0.2 },
      presets: [{ id: 'p1', name: 'Mine', config: amrap, createdAt: 1 }],
      history: [entry('h1', 1, 10)],
    };
    const file = new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' });
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByRole('dialog', { name: 'Restore backup?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(presetsStore.get().map((p) => p.id)).toEqual(['p1']);
    expect(historyStore.get().map((h) => h.id)).toEqual(['h1']);
    expect(settingsStore.get().volume).toBe(0.2);
  });
});

describe('History', () => {
  it('shows PR badges, records, the weekly chart and mode filters', () => {
    historyStore.set([
      entry('a', 10, 15),
      entry('b', 3, 18),
      { ...entry('c', 1, 0), id: 'c', name: '', mode: 'tabata', config: { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 0, movements: [] } },
    ]);
    withNav(<History />);
    expect(screen.getAllByText('Personal record').length).toBe(1);
    expect(screen.getByRole('heading', { name: 'Personal records' })).toBeTruthy();
    expect(screen.getByRole('table', { name: /minutes per week/i })).toBeTruthy();
    const filters = screen.getByRole('group', { name: 'Filter by mode' });
    expect(filters.querySelectorAll('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Tabata', pressed: false }));
    expect(screen.queryByText('Personal record')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tabata', pressed: true })).toBeTruthy();
  });
});

describe('Onboarding', () => {
  it('walks through three cards and saves prefs', () => {
    settingsStore.set({ ...defaultSettings, onboarded: false, language: 'en' });
    const done = vi.fn();
    withNav(<Onboarding onFinish={done} />);
    expect(screen.getAllByRole('group', { hidden: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play sound check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('radio', { name: '5s' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(settingsStore.get()).toMatchObject({ prepSec: 5, theme: 'light' });
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(settingsStore.get().onboarded).toBe(true);
    expect(done).toHaveBeenCalled();
  });

  it('can be skipped', () => {
    settingsStore.set({ ...defaultSettings, onboarded: false });
    withNav(<Onboarding />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(settingsStore.get().onboarded).toBe(true);
  });
});

describe('ShareButton', () => {
  it('copies the link when the share sheet is unavailable', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    withNav(<ShareButton config={amrap} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share workout' }));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#w=1\./));
    expect(screen.getByRole('status').textContent).toMatch('Link copied');
  });

  it('uses navigator.share when present', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    withNav(<ShareButton config={amrap} variant="button" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cindy', url: expect.stringContaining('#w=1.') }));
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
});

describe('App wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows onboarding on first launch', () => {
    settingsStore.set({ ...defaultSettings, onboarded: false, language: 'en' });
    render(<App />);
    expect(screen.getByRole('region', { name: 'Welcome to Pulse' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('region', { name: 'Welcome to Pulse' })).toBeNull();
  });

  it('opens a shared link from the hash while running', () => {
    render(<App />);
    act(() => {
      location.hash = `w=${encodeWorkout(amrap)}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const top = (history.state as { stack: Route[] }).stack.at(-1);
    expect(top).toMatchObject({ name: 'configure', mode: 'amrap', imported: true });
    expect(location.hash).toBe('');
    expect(screen.getAllByText(/Imported workout/).length).toBeGreaterThan(0);
  });
});
