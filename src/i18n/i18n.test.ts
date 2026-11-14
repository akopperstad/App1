import { describe, expect, it, vi } from 'vitest';
import type { Segment } from '../engine/types';
import { minutePhrase, segmentPhrase } from '../audio/phrases';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { LANGS, matchLang, resolveLang, spokenPhrases, translator } from './index';
import { nb } from './nb';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('dictionaries', () => {
  it('every language has every key, non-empty, with the same placeholders', () => {
    for (const d of [nb, de, es, fr]) {
      expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        expect(d[k].trim().length, k).toBeGreaterThan(0);
        expect(placeholders(d[k]), k).toBe(placeholders(en[k]));
      }
    }
  });
});

describe('t / tp', () => {
  it('interpolates and pluralises', () => {
    const { t, tp } = translator('en');
    expect(t('hist.min', { n: 12 })).toBe('12 min');
    expect(tp('hist.rounds', 1)).toBe('1 rd');
    expect(tp('hist.rounds', 5)).toBe('5 rds');
    expect(translator('nb').tp('hist.rounds', 2)).toBe('2 runder');
    expect(translator('fr').tp('hist.rounds', 0)).toBe('0 tour'); // French: 0 is singular
    expect(translator('de').t('settings.title')).toBe('Einstellungen');
  });
});

describe('language resolution', () => {
  it('maps tags and follows the device for auto', () => {
    expect(matchLang('nb-NO')).toBe('nb');
    expect(matchLang('no')).toBe('nb');
    expect(matchLang('nn-NO')).toBe('nb');
    expect(matchLang('de-AT')).toBe('de');
    expect(matchLang('pt-BR')).toBeNull();
    expect(resolveLang('fr')).toBe('fr');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR', 'es-MX']);
    expect(resolveLang('auto')).toBe('es');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja']);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja');
    expect(resolveLang('auto')).toBe('en');
    vi.restoreAllMocks();
  });
});

describe('spoken phrases', () => {
  const work: Segment = { kind: 'work', label: 'Work', durationMs: 20_000, direction: 'down', round: 3, totalRounds: 8 };
  const segs: Segment[] = [
    { kind: 'prep', label: 'Get ready', durationMs: 10_000, direction: 'down' },
    { kind: 'rest', label: 'Rest', durationMs: 10_000, direction: 'down' },
    { kind: 'rest', label: 'Set rest', durationMs: 60_000, direction: 'down' },
    work,
    { ...work, detail: 'Burpees' },
    { ...work, round: 8 },
    { ...work, label: 'EMOM', round: 4 },
    { ...work, label: 'E2MOM', detail: 'Squats', round: 4 },
    { ...work, label: 'Death by', detail: '15 burpees' },
    { ...work, label: 'AMRAP', set: 2, totalSets: 3 },
    { ...work, label: 'For time' },
    { ...work, label: 'Row 500m', round: undefined },
  ];

  it('English matches the audio layer exactly', () => {
    const p = spokenPhrases('en');
    for (const s of segs) expect(p.segment(s)).toBe(segmentPhrase(s));
    for (const [r, e] of [
      [5, 3],
      [null, 4],
      [1, 1],
      [61, 1],
      [null, 125],
    ] as [number | null, number][])
      expect(p.minute(r, e)).toBe(minutePhrase(r, e));
  });

  it('translates every language', () => {
    for (const l of LANGS) {
      const p = spokenPhrases(l);
      expect(p.speechLang.startsWith(l === 'nb' ? 'nb' : l)).toBe(true);
      for (const s of segs) expect(p.segment(s).length).toBeGreaterThan(0);
    }
    const nbp = spokenPhrases('nb');
    expect(nbp.segment(segs[2])).toBe('Settpause');
    expect(nbp.segment(work)).toBe('Runde 3 av 8');
    expect(nbp.minute(5, 0)).toBe('5 minutter igjen');
    expect(spokenPhrases('de').minute(null, 61)).toBe('1 Stunde 1 Minute');
    expect(spokenPhrases('es').segment({ ...work, detail: 'Burpees' })).toBe('Trabajo. Burpees');
    // User labels are spoken as typed.
    expect(spokenPhrases('fr').segment(segs[11])).toBe('Row 500m');
  });
});
