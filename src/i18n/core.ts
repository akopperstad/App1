/**
 * Pure i18n core — dictionaries, plural rules and interpolation, with no
 * dependency on the settings store. Engine / formatting modules import this
 * (they take a `Translator` argument and default to English), so they stay
 * language-agnostic and testable; React code uses `useT()` / `getT()` from
 * ./index, which resolves the user's language.
 */
import { de } from './de';
import { en, type Dict, type Key } from './en';
import { es } from './es';
import { fr } from './fr';
import { nb } from './nb';

export type { Key } from './en';
export type Lang = 'en' | 'nb' | 'de' | 'es' | 'fr';
export const LANGS: Lang[] = ['en', 'nb', 'de', 'es', 'fr'];

/** Each language's name in its own language (for the picker). */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  nb: 'Norsk bokmål',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
};

/** BCP 47 locale used for dates, numbers and speech. */
export const LOCALES: Record<Lang, string> = {
  en: 'en-US',
  nb: 'nb-NO',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
};

export const DICTS: Record<Lang, Dict> = { en, nb, de, es, fr };

/** Map a BCP 47 tag ("nb-NO", "no", "de-AT", "pt") to a supported language, or null. */
export function matchLang(tag: string | undefined | null): Lang | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  if (base === 'no' || base === 'nn' || base === 'nb') return 'nb';
  return (LANGS as string[]).includes(base) ? (base as Lang) : null;
}

type Vars = Record<string, string | number>;

/** Keys that have `_one` / `_other` forms, without the suffix. */
export type PluralKey = { [K in Key]: K extends `${infer B}_one` ? B : never }[Key];

function fill(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface Translator {
  lang: Lang;
  locale: string;
  t: (key: Key, vars?: Vars) => string;
  /** Plural-aware: picks `${key}_one` / `${key}_other`; `{n}` is filled with `n`. */
  tp: (key: PluralKey, n: number, vars?: Vars) => string;
}

const cache = new Map<Lang, Translator>();

export function translator(lang: Lang): Translator {
  const hit = cache.get(lang);
  if (hit) return hit;
  const dict = DICTS[lang];
  const locale = LOCALES[lang];
  let rules: Intl.PluralRules | null = null;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    rules = null;
  }
  const t = (key: Key, vars?: Vars) => fill(dict[key] ?? en[key] ?? key, vars);
  const tp = (key: PluralKey, n: number, vars?: Vars) => {
    const cat = rules ? rules.select(n) : n === 1 ? 'one' : 'other';
    const k = (cat === 'one' ? `${key}_one` : `${key}_other`) as Key;
    return t(k, { n, ...vars });
  };
  const tr: Translator = { lang, locale, t, tp };
  cache.set(lang, tr);
  return tr;
}

/** English — the default for pure modules (engine, formatting) and tests. */
export const EN: Translator = translator('en');

const REST_WORDS = new Set(['rest', ...LANGS.map((l) => DICTS[l]['seg.rest'].trim().toLowerCase())]);

/**
 * Whether a user-entered movement / step name is just "Rest" in any supported
 * language (EMOM "rest minutes", custom rest steps) — so a workout built in
 * Norwegian still gets rest segments, and its label is shown translated.
 */
export function isRestWord(s: string | undefined | null): boolean {
  return typeof s === 'string' && REST_WORDS.has(s.trim().toLowerCase());
}
