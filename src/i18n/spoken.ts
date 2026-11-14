/**
 * Translated spoken announcements. Mirrors src/audio/phrases.ts (English,
 * owned by the audio layer) so cues can speak in the user's language:
 *
 *   const p = spokenPhrases(resolveLang(settings.language));
 *   say(p.segment(seg), volume, p.speechLang)
 *   p.halfway, p.tenSeconds, p.finish, p.minute(remaining, elapsed) …
 *
 * Phrases stay short — they are spoken over loud music mid-workout.
 */
import type { Segment } from '../engine/types';
import type { Lang } from './index';

export interface SpokenPhrases {
  /** BCP 47 tag to pick a matching speechSynthesis voice. */
  speechLang: string;
  getReady: string;
  work: string;
  rest: string;
  go: string;
  lastRound: string;
  halfway: string;
  tenSeconds: string;
  finish: string;
  soundCheck: string;
  oneMinuteRemaining: string;
  round: (n: number) => string;
  roundOf: (n: number, total: number) => string;
  amrapSet: (n: number) => string;
  /** "5 minutes", "1 hour 5 minutes" */
  duration: (totalMin: number) => string;
  /** "5 minutes remaining" */
  remaining: (duration: string) => string;
  /** Full phrase for entering a segment (same rules as phrases.segmentPhrase). */
  segment: (seg: Segment) => string;
  /** Minute-mark phrase (same rules as phrases.minutePhrase). */
  minute: (minutesRemaining: number | null, minutesElapsed: number) => string;
}

interface Base {
  speechLang: string;
  getReady: string;
  work: string;
  rest: string;
  go: string;
  lastRound: string;
  halfway: string;
  tenSeconds: string;
  finish: string;
  soundCheck: string;
  oneMinuteRemaining: string;
  round: (n: number) => string;
  roundOf: (n: number, total: number) => string;
  amrapSet: (n: number) => string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  remaining: (duration: string) => string;
}

const BASES: Record<Lang, Base> = {
  en: {
    speechLang: 'en-US',
    getReady: 'Get ready',
    work: 'Work',
    rest: 'Rest',
    go: 'Go',
    lastRound: 'Last round',
    halfway: 'Halfway',
    tenSeconds: 'Ten seconds',
    finish: 'Time! Great work',
    soundCheck: 'Sound check',
    oneMinuteRemaining: 'One minute remaining',
    round: (n) => `Round ${n}`,
    roundOf: (n, t) => `Round ${n} of ${t}`,
    amrapSet: (n) => `AMRAP ${n}. Go`,
    minutes: (n) => `${n} minute${n === 1 ? '' : 's'}`,
    hours: (n) => `${n} hour${n === 1 ? '' : 's'}`,
    remaining: (d) => `${d} remaining`,
  },
  nb: {
    speechLang: 'nb-NO',
    getReady: 'Gjør deg klar',
    work: 'Jobb',
    rest: 'Hvile',
    go: 'Kjør',
    lastRound: 'Siste runde',
    halfway: 'Halvveis',
    tenSeconds: 'Ti sekunder',
    finish: 'Tid! Bra jobba',
    soundCheck: 'Lydtest',
    oneMinuteRemaining: 'Ett minutt igjen',
    round: (n) => `Runde ${n}`,
    roundOf: (n, t) => `Runde ${n} av ${t}`,
    amrapSet: (n) => `AMRAP ${n}. Kjør`,
    minutes: (n) => `${n} ${n === 1 ? 'minutt' : 'minutter'}`,
    hours: (n) => `${n} ${n === 1 ? 'time' : 'timer'}`,
    remaining: (d) => `${d} igjen`,
  },
  de: {
    speechLang: 'de-DE',
    getReady: 'Mach dich bereit',
    work: 'Arbeit',
    rest: 'Pause',
    go: 'Los',
    lastRound: 'Letzte Runde',
    halfway: 'Halbzeit',
    tenSeconds: 'Zehn Sekunden',
    finish: 'Zeit! Super gemacht',
    soundCheck: 'Tontest',
    oneMinuteRemaining: 'Noch eine Minute',
    round: (n) => `Runde ${n}`,
    roundOf: (n, t) => `Runde ${n} von ${t}`,
    amrapSet: (n) => `AMRAP ${n}. Los`,
    minutes: (n) => `${n} ${n === 1 ? 'Minute' : 'Minuten'}`,
    hours: (n) => `${n} ${n === 1 ? 'Stunde' : 'Stunden'}`,
    remaining: (d) => `Noch ${d}`,
  },
  es: {
    speechLang: 'es-ES',
    getReady: 'Prepárate',
    work: 'Trabajo',
    rest: 'Descanso',
    go: 'Ya',
    lastRound: 'Última ronda',
    halfway: 'Mitad',
    tenSeconds: 'Diez segundos',
    finish: '¡Tiempo! Buen trabajo',
    soundCheck: 'Prueba de sonido',
    oneMinuteRemaining: 'Queda un minuto',
    round: (n) => `Ronda ${n}`,
    roundOf: (n, t) => `Ronda ${n} de ${t}`,
    amrapSet: (n) => `AMRAP ${n}. Ya`,
    minutes: (n) => `${n} ${n === 1 ? 'minuto' : 'minutos'}`,
    hours: (n) => `${n} ${n === 1 ? 'hora' : 'horas'}`,
    remaining: (d) => `Quedan ${d}`,
  },
  fr: {
    speechLang: 'fr-FR',
    getReady: 'Préparez-vous',
    work: 'Effort',
    rest: 'Repos',
    go: 'Partez',
    lastRound: 'Dernier tour',
    halfway: 'Mi-temps',
    tenSeconds: 'Dix secondes',
    finish: 'Temps ! Beau travail',
    soundCheck: 'Test du son',
    oneMinuteRemaining: 'Plus qu’une minute',
    round: (n) => `Tour ${n}`,
    roundOf: (n, t) => `Tour ${n} sur ${t}`,
    amrapSet: (n) => `AMRAP ${n}. Partez`,
    minutes: (n) => `${n} ${n === 1 ? 'minute' : 'minutes'}`,
    hours: (n) => `${n} ${n === 1 ? 'heure' : 'heures'}`,
    remaining: (d) => `Encore ${d}`,
  },
};

const cache = new Map<Lang, SpokenPhrases>();

export function spokenPhrases(lang: Lang): SpokenPhrases {
  const hit = cache.get(lang);
  if (hit) return hit;
  const b = BASES[lang] ?? BASES.en;

  const duration = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return b.minutes(m);
    return m ? `${b.hours(h)} ${b.minutes(m)}` : b.hours(h);
  };

  /** Built-in English labels from compile.ts are replaced; user labels are spoken as typed. */
  const builtIn = (label: string, fallback: string): string => {
    if (lang === 'en') return label || fallback;
    const l = label.toLowerCase();
    if (l === 'rest' || l === 'set rest' || l === 'round rest') return b.rest;
    if (l === 'work') return b.work;
    return label || fallback;
  };

  const segment = (seg: Segment): string => {
    const label = (seg.label || '').trim();
    const detail = (seg.detail || '').trim();
    const lower = label.toLowerCase();

    if (seg.kind === 'prep') return b.getReady;
    if (seg.kind === 'rest') return builtIn(label, b.rest);

    if (seg.round && (label === 'EMOM' || /^E(\d+MOM|\d+:\d\d)$/.test(label))) {
      return detail ? `${b.round(seg.round)}. ${detail}` : b.round(seg.round);
    }
    if (lower === 'death by') return detail || (seg.round ? b.round(seg.round) : b.go);
    if (lower === 'work') {
      if (detail) return `${b.work}. ${detail}`;
      if (seg.round && seg.totalRounds && seg.totalRounds > 1) {
        if (seg.round === seg.totalRounds && (!seg.totalSets || seg.set === seg.totalSets)) return b.lastRound;
        return b.roundOf(seg.round, seg.totalRounds);
      }
      return b.work;
    }
    if (lower === 'amrap') {
      return seg.totalSets && seg.totalSets > 1 && seg.set ? b.amrapSet(seg.set) : b.go;
    }
    if (lower === 'for time' || lower === 'countdown' || lower === 'stopwatch') return b.go;
    return detail ? `${label}. ${detail}` : label || b.go;
  };

  const minute = (minutesRemaining: number | null, minutesElapsed: number): string => {
    if (minutesRemaining !== null) {
      return minutesRemaining === 1 ? b.oneMinuteRemaining : b.remaining(duration(minutesRemaining));
    }
    return duration(minutesElapsed);
  };

  const p: SpokenPhrases = {
    speechLang: b.speechLang,
    getReady: b.getReady,
    work: b.work,
    rest: b.rest,
    go: b.go,
    lastRound: b.lastRound,
    halfway: b.halfway,
    tenSeconds: b.tenSeconds,
    finish: b.finish,
    soundCheck: b.soundCheck,
    oneMinuteRemaining: b.oneMinuteRemaining,
    round: b.round,
    roundOf: b.roundOf,
    amrapSet: b.amrapSet,
    duration,
    remaining: b.remaining,
    segment,
    minute,
  };
  cache.set(lang, p);
  return p;
}
