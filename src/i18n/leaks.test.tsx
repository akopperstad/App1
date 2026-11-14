/**
 * Renders the main screens in every non-English language and fails if a
 * known-English UI word leaks through (a heuristic: words that are not valid
 * UI text in nb / de / es / fr). Covers visible text and accessible names
 * (aria-label, placeholder, title).
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODES } from '../engine/modes';
import type { WorkoutConfig } from '../engine/types';
import { NavContext, type Nav } from '../nav';
import { Configure } from '../screens/Configure';
import { History } from '../screens/History';
import { Home } from '../screens/Home';
import { Run } from '../screens/Run';
import { SettingsScreen } from '../screens/Settings';
import { defaultSettings, historyStore, lastConfigStore, presetsStore, settingsStore, type HistoryEntry } from '../state/store';
import type { Lang } from './core';

const LANGS: Lang[] = ['nb', 'de', 'es', 'fr'];

/** English UI words / phrases that must not appear in a translated screen. */
const LEAKS = [
  'Get ready', 'Work', 'Rest', 'Round', 'Rounds', 'Save', 'Saved', 'Settings', 'History', 'Back', 'Close',
  'Duration', 'Every', 'Movement', 'Movements', 'Remaining', 'Elapsed', 'Resume', 'Paused', 'Quick start',
  'Total time', 'Untimed', 'Timed', 'Tap', 'Add', 'Delete', 'Edit', 'Next', 'Next up', 'Lap', 'Laps', 'step',
  'steps', 'trained', 'this week', 'workouts', 'workout', 'Workout', 'Stopwatch', 'Intervals', 'Interval',
  'Custom', 'Skip', 'Fullscreen', 'Space', 'Open-ended', 'As many', 'Every minute', 'Race the clock',
  'Simple timer', 'Count up', 'Sets', 'Set', 'No cap', 'Finish', 'Done', 'Start now', 'Timers', 'Repeat',
  'Home', 'Increase', 'Decrease', 'Change', 'Seconds', 'Summary', 'Timeline', 'overview', 'segments',
  'Play over music', 'Alerts when locked', 'until failure', 'rest', 'round', 'interval', 'intervals',
];
/** Words that are also correct in that language ("Workout" is standard German, "segments" French). */
const SAME_IN: Partial<Record<Lang, string[]>> = {
  de: ['Workout', 'workout', 'workouts', 'Home', 'Timers'],
  fr: ['segments'],
};
const leakRe = (lang: Lang) => {
  const words = LEAKS.filter((w) => !SAME_IN[lang]?.includes(w));
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?<![\\p{L}])(${alt})(?![\\p{L}])`, 'u');
};

/** Proper names / content that legitimately stay English (benchmarks, seeded user data). */
const ALLOWED = ['Fight Gone Bad', 'Death by Burpees', 'Fran (cap 10)', 'Cindy', 'My Session'];

function collect(): string {
  const parts = [document.body.textContent ?? ''];
  document.body.querySelectorAll('[aria-label], [placeholder], [title]').forEach((el) => {
    for (const a of ['aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute(a);
      if (v) parts.push(v);
    }
  });
  let text = parts.join(' \n ');
  for (const a of ALLOWED) text = text.split(a).join(' ');
  return text;
}

function expectNoLeak(where: string) {
  const text = collect();
  const m = text.match(leakRe(settingsStore.get().language as Lang));
  if (m) {
    const i = m.index ?? 0;
    throw new Error(`${where}: English "${m[1]}" leaked in …${text.slice(Math.max(0, i - 40), i + 40)}…`);
  }
  expect(m).toBeNull();
}

function nav(): Nav {
  return { route: { name: 'home' }, go: vi.fn(), replace: vi.fn(), back: vi.fn() };
}
function mount(ui: React.ReactNode) {
  return render(<NavContext.Provider value={nav()}>{ui}</NavContext.Provider>);
}

const seeded: HistoryEntry = {
  id: 'h1',
  name: '',
  mode: 'interval',
  config: { mode: 'interval', workSec: 40, restSec: 20, rounds: 10, sets: 2, restBetweenSetsSec: 60, movements: [] },
  startedAt: Date.now() - 3_600_000,
  durationMs: 1_500_000,
  completed: true,
  rounds: 10,
  roundTimesMs: [],
  laps: [],
};

function setLang(language: Lang, prepSec = 0) {
  settingsStore.set({ ...defaultSettings, onboarded: true, language, prepSec, sound: false, voice: false, vibration: false });
}

beforeEach(() => {
  historyStore.set([]);
  presetsStore.set([]);
  lastConfigStore.set({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(LANGS)('no English leaks (%s)', (lang) => {
  it('Home', () => {
    setLang(lang);
    historyStore.set([seeded]);
    presetsStore.set([{ id: 'p1', name: 'My Session', config: MODES[0].defaults, createdAt: 1 }]);
    mount(<Home />);
    expect(document.documentElement).toBeTruthy();
    expectNoLeak('Home');
  });

  it('History + Home with sessions saved the way the run screen saves them (English mode title as name)', () => {
    setLang(lang);
    // buildEntry() stores unnamed workouts under the English mode title, and
    // older versions did the same: those must be shown in the UI language.
    historyStore.set([
      { ...seeded, id: 'a', name: 'Intervals' },
      { ...seeded, id: 'b', name: 'Stopwatch', mode: 'stopwatch', config: { mode: 'stopwatch' } },
    ]);
    const home = mount(<Home />);
    expectNoLeak('Home (recent session)');
    home.unmount();
    mount(<History />);
    expectNoLeak('History');
  });

  it('Configure (every mode)', () => {
    setLang(lang);
    for (const m of MODES) {
      const { unmount } = mount(<Configure mode={m.mode} />);
      expectNoLeak(`Configure ${m.mode}`);
      unmount();
    }
    // Movement lists filled in, multi-set intervals.
    const { unmount } = mount(
      <Configure
        mode="interval"
        initial={{ mode: 'interval', workSec: 30, restSec: 15, rounds: 4, sets: 3, restBetweenSetsSec: 60, movements: ['Burpees', 'Squats'] }}
      />,
    );
    expectNoLeak('Configure interval (movements)');
    unmount();
  });

  it('Settings', () => {
    setLang(lang);
    mount(<SettingsScreen />);
    expectNoLeak('Settings');
  });

  it('Run (idle, get ready, work, rest, finished)', () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
    const start = () => act(() => void fireEvent.click(document.querySelector('.start')!));

    const configs: WorkoutConfig[] = [
      { mode: 'interval', workSec: 20, restSec: 10, rounds: 2, sets: 2, restBetweenSetsSec: 30, movements: [] },
      ...MODES.map((m) => m.defaults).filter((c) => c.mode !== 'interval'),
    ];
    for (const config of configs) {
      setLang(lang, 3);
      const { unmount } = mount(<Run config={config} />);
      expectNoLeak(`Run ${config.mode} idle`);
      start();
      advance(500);
      expectNoLeak(`Run ${config.mode} get ready`);
      advance(3_000);
      expectNoLeak(`Run ${config.mode} work`);
      if (config.mode === 'interval') {
        advance(20_000);
        expect(document.querySelector('.run')?.getAttribute('data-phase')).toBe('rest');
        expectNoLeak('Run interval rest');
        advance(10_000 + 20_000);
        expectNoLeak('Run interval set rest');
        // Pause → "paused" chip
        act(() => void fireEvent.click(document.querySelector('.transport__play')!));
        expectNoLeak('Run interval paused');
      }
      unmount();
    }

    // Finished summary (natural finish) and ended early.
    setLang(lang, 0);
    const { unmount } = mount(<Run config={{ mode: 'countdown', durationSec: 2 }} />);
    start();
    advance(3_000);
    expect(document.querySelector('.summary')).toBeTruthy();
    expectNoLeak('Run finished');
    unmount();

    setLang(lang, 0);
    const ft = mount(<Run config={{ mode: 'fortime', capSec: 2, targetRounds: 0 }} />);
    start();
    advance(3_000);
    expect(document.querySelector('.summary')).toBeTruthy();
    expectNoLeak('Run For Time capped');
    ft.unmount();
  });

  it('<html lang> follows the language', async () => {
    setLang(lang);
    const { useDocumentLang } = await import('./index');
    function Probe() {
      useDocumentLang();
      return null;
    }
    mount(<Probe />);
    expect(document.documentElement.lang).toBe(lang);
  });
});

describe('leak heuristic', () => {
  it('catches English in an otherwise translated screen', () => {
    setLang('nb');
    mount(<p>Pause · Rest</p>);
    expect(() => expectNoLeak('probe')).toThrow(/Rest/);
  });
});
