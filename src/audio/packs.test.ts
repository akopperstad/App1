import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUND_PACKS } from '../state/store';
import { PACKS, packDef } from './packs';

/** Records every oscillator / buffer source started, with its type and frequency. */
function mockCtx() {
  const param = (v = 0) => ({
    value: v,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const started: { kind: string; type?: string; freq?: number; t: number; stop?: number }[] = [];
  const ctx = {
    currentTime: 2,
    sampleRate: 8000,
    destination: node(),
    createGain: () => ({ ...node(), gain: param(1) }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
    createOscillator: () => {
      const o = {
        ...node(),
        type: 'sine',
        frequency: param(),
        onended: null as null | (() => void),
        start: (t: number) => started.push({ kind: 'osc', type: o.type, freq: o.frequency.setValueAtTime.mock.calls[0]?.[0], t }),
        stop: vi.fn(),
      };
      return o;
    },
    createBuffer: (_c: number, len: number) => {
      const data = new Float32Array(len);
      return { getChannelData: () => data };
    },
    createBufferSource: () => ({ ...node(), buffer: null, onended: null, start: (t: number) => started.push({ kind: 'noise', t }), stop: vi.fn() }),
  };
  return { ctx: ctx as unknown as AudioContext, started, out: node() as unknown as AudioNode };
}

const CUES = ['countdown', 'go', 'rest', 'tick', 'finish', 'milestone'] as const;

afterEach(() => vi.restoreAllMocks());

describe('sound packs', () => {
  it('every pack builds every cue, scheduled in the future', () => {
    for (const pack of SOUND_PACKS) {
      const def = PACKS[pack];
      for (const cue of CUES) {
        const { ctx, started, out } = mockCtx();
        def[cue](ctx, out, 0.5);
        expect(started.length, `${pack}.${cue}`).toBeGreaterThan(0);
        expect(started.every((s) => s.t >= 2.5)).toBe(true);
      }
      for (const up of [true, false]) {
        const { ctx, started, out } = mockCtx();
        def.click(ctx, out, up);
        expect(started.length).toBeGreaterThan(0);
      }
    }
  });

  it('packs have distinct timbres', () => {
    const sig = (pack: (typeof SOUND_PACKS)[number]) => {
      const { ctx, started, out } = mockCtx();
      PACKS[pack].go(ctx, out);
      return JSON.stringify(started.map((s) => [s.kind, s.type, Math.round(s.freq ?? 0)]));
    };
    const sigs = SOUND_PACKS.map(sig);
    expect(new Set(sigs).size).toBe(SOUND_PACKS.length);
    // Spot-check the character of each pack.
    const types = (pack: (typeof SOUND_PACKS)[number]) => {
      const { ctx, started, out } = mockCtx();
      PACKS[pack].countdown(ctx, out);
      return started;
    };
    expect(types('digital').every((s) => s.type === 'square')).toBe(true);
    expect(types('boxing').filter((s) => s.kind === 'osc').length).toBeGreaterThanOrEqual(5); // inharmonic partials
    expect(types('whistle').some((s) => s.kind === 'noise')).toBe(true); // breath
    expect(types('soft').every((s) => s.kind === 'osc' && (s.freq ?? 0) < 7000)).toBe(true);
  });

  it('survives contexts without noise buffers', () => {
    const { ctx, out } = mockCtx();
    (ctx as unknown as { createBuffer: () => object }).createBuffer = () => ({});
    for (const pack of SOUND_PACKS) for (const cue of CUES) expect(() => PACKS[pack][cue](ctx, out)).not.toThrow();
  });

  it('falls back to classic for unknown packs', () => {
    expect(packDef(undefined)).toBe(PACKS.classic);
    expect(packDef('kazoo' as never)).toBe(PACKS.classic);
  });
});

describe('synth follows settings.soundPack', () => {
  it('uses the pack from the store when none is passed', async () => {
    vi.resetModules();
    const { settingsStore, defaultSettings } = await import('../state/store');
    const ctxMock = mockCtx();
    vi.doMock('./context', () => ({
      withAudio: (fn: (c: AudioContext, o: AudioNode) => void) => fn(ctxMock.ctx, ctxMock.out),
      setVolume: () => {},
      unlockAudio: () => {},
    }));
    const synth = await import('./synth');
    const freqs = () => ctxMock.started.splice(0).map((x) => Math.round(x.freq ?? 0));
    settingsStore.set({ ...defaultSettings, soundPack: 'boxing' });
    synth.goTone();
    expect(freqs()).toContain(980); // bell fundamental
    synth.countdownBeep('digital');
    expect(freqs()).toEqual([2730]);
    settingsStore.set({ ...defaultSettings, soundPack: 'classic' });
    synth.countdownBeep();
    expect(freqs()).toContain(880);
    synth.previewPack('whistle', 0.5);
    expect(freqs()).toContain(3000);
    vi.doUnmock('./context');
  });
});
