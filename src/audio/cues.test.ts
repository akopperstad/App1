import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cue, Segment } from '../engine/types';
import { defaultSettings, type Settings } from '../state/store';
import { cuePlayer } from './cues';
import { minutePhrase, segmentPhrase } from './phrases';

const work: Segment = { kind: 'work', label: 'Work', detail: 'Burpees', durationMs: 20_000, direction: 'down', round: 3, totalRounds: 8 };
const rest: Segment = { kind: 'rest', label: 'Rest', durationMs: 10_000, direction: 'down' };
const prep: Segment = { kind: 'prep', label: 'Get ready', durationMs: 10_000, direction: 'down' };

const cues: Cue[] = [
  { type: 'start', segment: prep, index: 0 },
  { type: 'start', segment: work, index: 0 },
  { type: 'segment', segment: work, index: 1, previous: prep },
  { type: 'segment', segment: rest, index: 2, previous: work },
  { type: 'segment', segment: prep, index: 0, previous: work },
  { type: 'countdown', n: 3, segment: work },
  { type: 'countdown', n: 2, segment: work },
  { type: 'countdown', n: 1, segment: work },
  { type: 'halfway', segment: work },
  { type: 'tenSeconds', segment: rest },
  { type: 'minute', minutesRemaining: 5, minutesElapsed: 3, segment: work },
  { type: 'minute', minutesRemaining: null, minutesElapsed: 4, segment: work },
  { type: 'finish' },
  { type: 'pause' },
  { type: 'resume' },
];

const flags = ['sound', 'voice', 'vibration', 'countdownBeeps', 'milestoneCues'] as const;

function* combos(): Generator<Settings> {
  for (let mask = 0; mask < 1 << flags.length; mask++) {
    for (const volume of [0, 0.5, 1]) {
      const s: Settings = { ...defaultSettings, volume };
      flags.forEach((f, i) => (s[f] = !!(mask & (1 << i))));
      yield s;
    }
  }
}

function runAll() {
  cuePlayer.unlock();
  for (const s of combos()) {
    for (const c of cues) cuePlayer.handle(c, s);
    cuePlayer.test(s);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cuePlayer', () => {
  it('never throws in plain jsdom (no AudioContext / speechSynthesis)', async () => {
    vi.useFakeTimers();
    expect(runAll).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('never throws with hostile browser APIs', () => {
    vi.useFakeTimers();
    const boom = () => {
      throw new Error('boom');
    };
    vi.stubGlobal('AudioContext', boom);
    vi.stubGlobal('speechSynthesis', { speak: boom, cancel: boom, getVoices: boom, addEventListener: boom });
    vi.stubGlobal('SpeechSynthesisUtterance', boom);
    Object.defineProperty(navigator, 'vibrate', { value: boom, configurable: true });
    expect(runAll).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('drives a mock speech engine and vibration', () => {
    vi.useFakeTimers();
    const spoken: string[] = [];
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      pending: false,
      paused: false,
      speak: (u: { text: string }) => spoken.push(u.text),
      cancel: () => {},
      resume: () => {},
      getVoices: () => [],
      addEventListener: () => {},
    });
    const s = { ...defaultSettings };
    cuePlayer.handle({ type: 'segment', segment: work, index: 1, previous: prep }, s);
    vi.runAllTimers();
    cuePlayer.handle({ type: 'halfway', segment: work }, s);
    cuePlayer.handle({ type: 'minute', minutesRemaining: 2, minutesElapsed: 2, segment: work }, s);
    vi.runAllTimers();
    cuePlayer.handle({ type: 'countdown', n: 3, segment: work }, s);
    cuePlayer.handle({ type: 'finish' }, s);
    vi.runAllTimers();
    expect(spoken).toEqual(['Work. Burpees', 'Halfway. 2 minutes remaining', 'Time! Great work']);
    expect(vibrate).toHaveBeenCalled();
  });

  it('pause and stop() cancel queued and in-flight speech (nothing spoken after leaving)', () => {
    vi.useFakeTimers();
    const spoken: string[] = [];
    const cancel = vi.fn();
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      pending: false,
      paused: false,
      speak: (u: { text: string }) => spoken.push(u.text),
      cancel,
      resume: () => {},
      getVoices: () => [],
      addEventListener: () => {},
    });
    const s = { ...defaultSettings };
    cuePlayer.handle({ type: 'tenSeconds', segment: work }, s);
    cuePlayer.handle({ type: 'pause' }, s);
    vi.runAllTimers();
    expect(spoken).toEqual([]);
    expect(cancel).toHaveBeenCalled();

    cancel.mockClear();
    cuePlayer.handle({ type: 'tenSeconds', segment: work }, s);
    cuePlayer.stop();
    vi.runAllTimers();
    expect(spoken).toEqual([]);
    expect(cancel).toHaveBeenCalled();

    // Speech still works afterwards.
    cuePlayer.handle({ type: 'halfway', segment: work }, s);
    vi.runAllTimers();
    expect(spoken).toEqual(['Halfway']);
  });
});

describe('phrases', () => {
  it('keeps announcements short and mode-aware', () => {
    expect(segmentPhrase(prep)).toBe('Get ready');
    expect(segmentPhrase(rest)).toBe('Rest');
    expect(segmentPhrase({ ...work, detail: undefined })).toBe('Round 3 of 8');
    expect(segmentPhrase({ ...work, label: 'EMOM', detail: undefined, round: 4 })).toBe('Round 4');
    expect(segmentPhrase({ ...work, label: 'E2MOM', detail: 'Squats', round: 4 })).toBe('Round 4. Squats');
    expect(segmentPhrase({ ...work, label: 'Death by', detail: '15 burpees' })).toBe('15 burpees');
    expect(minutePhrase(5, 3)).toBe('5 minutes remaining');
    expect(minutePhrase(null, 4)).toBe('4 minutes');
    expect(minutePhrase(null, 1)).toBe('1 minute');
    expect(minutePhrase(null, 60)).toBe('1 hour');
    expect(minutePhrase(null, 125)).toBe('2 hours 5 minutes');
    expect(minutePhrase(61, 1)).toBe('1 hour 1 minute remaining');
    expect(minutePhrase(1, 1)).toBe('One minute remaining');
  });
});

describe('synth graph with a mock AudioContext', () => {
  it('builds and schedules nodes without throwing', async () => {
    vi.resetModules();
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    });
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    const starts: number[] = [];
    class MockCtx {
      state = 'running';
      currentTime = 1;
      destination = node();
      resume = () => Promise.resolve();
      createDynamicsCompressor = () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
      createGain = () => ({ ...node(), gain: param() });
      createBiquadFilter = () => ({ ...node(), type: '', frequency: param(), Q: param() });
      createOscillator = () => ({ ...node(), type: '', frequency: param(), start: (t: number) => starts.push(t), stop: vi.fn(), onended: null });
      createBuffer = () => ({});
      createBufferSource = () => ({ ...node(), buffer: null, start: vi.fn() });
    }
    vi.stubGlobal('AudioContext', MockCtx);
    const { cuePlayer: fresh } = await import('./cues');
    fresh.unlock();
    for (const c of cues) fresh.handle(c, { ...defaultSettings });
    expect(starts.length).toBeGreaterThan(10);
    expect(starts.every((t) => t >= 1)).toBe(true);
  });
});
