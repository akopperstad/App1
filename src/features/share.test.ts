import { describe, expect, it } from 'vitest';
import { BUILT_IN_PRESETS, MODES } from '../engine/modes';
import { normalizeConfig } from '../engine/normalize';
import type { WorkoutConfig } from '../engine/types';
import { decodeWorkout, encodeWorkout, parseShared, shareBase, shareUrl } from './share';

const b64u = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const stripIds = (c: WorkoutConfig | null) =>
  c && c.mode === 'custom' ? { ...c, steps: c.steps.map(({ id: _id, ...s }) => s) } : c;

const samples: WorkoutConfig[] = [
  ...MODES.map((m) => m.defaults),
  ...BUILT_IN_PRESETS.map((p) => p.config),
  { mode: 'amrap', durationSec: 7 * 60, sets: 4, restBetweenSetsSec: 90, name: 'Sprint AMRAPs' },
  { mode: 'emom', intervalSec: 90, rounds: 12, movements: ['Burpees', 'Rest', 'Wall balls 🏐'], name: 'E1:30 ×12' },
  { mode: 'tabata', workSec: 20, restSec: 10, rounds: 8, sets: 3, restBetweenSetsSec: 120, movements: [] },
  { mode: 'interval', workSec: 45, restSec: 15, rounds: 6, sets: 2, restBetweenSetsSec: 60, movements: ['Row', 'Bike'] },
  { mode: 'fortime', capSec: 0, targetRounds: 5, name: 'Åsgård “quoted” løp' },
  { mode: 'countdown', durationSec: 95 },
  { mode: 'stopwatch', name: 'Run' },
  { mode: 'deathby', intervalSec: 60, startReps: 2, increment: 2, maxRounds: 25, movement: 'Thrusters' },
  {
    mode: 'custom',
    rounds: 4,
    restBetweenRoundsSec: 30,
    steps: [
      { id: 'a', label: 'Run 400m', kind: 'work', durationSec: 0 },
      { id: 'b', label: '21 KB swings', kind: 'work', durationSec: 90 },
      { id: 'c', label: 'Breathe', kind: 'rest', durationSec: 60 },
    ],
    name: 'Custom chipper',
  },
];

describe('share codes', () => {
  it('round-trips every mode and the benchmarks', () => {
    for (const c of samples) {
      const code = encodeWorkout(c);
      expect(code).toMatch(/^1\.[A-Za-z0-9_-]+$/);
      const back = decodeWorkout(code);
      expect(back?.mode).toBe(c.mode);
      expect(stripIds(back)).toEqual(stripIds(normalizeConfig(c)));
    }
  });

  it('is compact', () => {
    expect(encodeWorkout(MODES[0].defaults).length).toBeLessThan(20);
    const cindy = BUILT_IN_PRESETS[0].config;
    expect(encodeWorkout(cindy).length).toBeLessThan(60);
  });

  it('gives custom steps unique ids', () => {
    const back = decodeWorkout(encodeWorkout(samples[samples.length - 1]));
    expect(back?.mode).toBe('custom');
    if (back?.mode !== 'custom') return;
    expect(new Set(back.steps.map((s) => s.id)).size).toBe(back.steps.length);
  });

  it('rejects garbage', () => {
    const bad: unknown[] = [
      undefined,
      null,
      42,
      '',
      '1.',
      'hello',
      '2.eyJrIjoiYSJ9', // unknown version
      '1.!!!!',
      '1.' + b64u('not json'),
      '1.' + b64u('[1,2,3]'),
      '1.' + b64u('{"k":"zz"}'), // unknown mode
      '1.' + b64u('{"k":"__proto__"}'),
      '1.' + b64u('{"k":"x","q":[]}'), // custom without steps
      '1.' + 'A'.repeat(20_000), // too long
    ];
    for (const b of bad) expect(decodeWorkout(b)).toBeNull();
  });

  it('clamps hostile values through normalizeConfig', () => {
    const json = JSON.stringify({ k: 'a', d: -5, s: 1e12, b: 'x', n: 'x'.repeat(500), evil: 1, __proto__: { polluted: 1 } });
    const code = '1.' + b64u(json);
    const c = decodeWorkout(code);
    expect(c?.mode).toBe('amrap');
    if (c?.mode !== 'amrap') return;
    expect(c.durationSec).toBe(1);
    expect(c.sets).toBeLessThanOrEqual(7 * 24 * 3600);
    expect(c.restBetweenSetsSec).toBe(60);
    expect(c.name?.length).toBe(80);
    expect('evil' in c).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('parses links, hashes and bare codes', () => {
    const c = samples[1];
    const url = shareUrl(c, 'https://example.com/app/');
    expect(url.startsWith('https://example.com/app/#w=1.')).toBe(true);
    expect(parseShared(url)?.mode).toBe(c.mode);
    expect(parseShared(url.slice(url.indexOf('#')))?.mode).toBe(c.mode);
    expect(parseShared(encodeWorkout(c))?.mode).toBe(c.mode);
    expect(parseShared(`Try this: ${url} 💪`)?.mode).toBe(c.mode);
    expect(parseShared('https://example.com/#w=nope')).toBeNull();
    expect(parseShared('')).toBeNull();
  });

  it('uses the page address on the public web', () => {
    expect(shareBase({ protocol: 'https:', hostname: 'pulse.example', origin: 'https://pulse.example', pathname: '/t/' })).toBe(
      'https://pulse.example/t/',
    );
  });
});
