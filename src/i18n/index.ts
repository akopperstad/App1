/**
 * Tiny typed i18n — no dependencies.
 *
 *   const { t, tp } = useT();
 *   t('hist.min', { n: 12 })        // "12 min"
 *   tp('hist.rounds', 3)            // plural via Intl.PluralRules → "3 rds"
 *
 * Language comes from settings.language ('auto' follows the device).
 */
import { useEffect, useMemo } from 'react';
import { settingsStore, useSettings } from '../state/store';
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

const DICTS: Record<Lang, Dict> = { en, nb, de, es, fr };

/** Map a BCP 47 tag ("nb-NO", "no", "de-AT", "pt") to a supported language, or null. */
export function matchLang(tag: string | undefined | null): Lang | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  if (base === 'no' || base === 'nn' || base === 'nb') return 'nb';
  return (LANGS as string[]).includes(base) ? (base as Lang) : null;
}

/** Device language (first supported entry of navigator.languages), defaulting to English. */
export function deviceLang(): Lang {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const list = nav ? [...(nav.languages ?? []), nav.language] : [];
    for (const tag of list) {
      const m = matchLang(tag);
      if (m) return m;
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

/** Resolve settings.language ('auto' | 'en' | 'nb' | …) to a supported language. */
export function resolveLang(setting: string | undefined): Lang {
  if (!setting || setting === 'auto') return deviceLang();
  return matchLang(setting) ?? deviceLang();
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

/** Translator for the current settings (non-React code). */
export function getT(): Translator {
  return translator(resolveLang(settingsStore.get().language));
}

/** React hook: re-renders when the language setting changes. */
export function useT(): Translator {
  const { language } = useSettings();
  return useMemo(() => translator(resolveLang(language)), [language]);
}

/** Keep <html lang> in sync with the chosen language (screen readers, hyphenation). */
export function useDocumentLang(): void {
  const { lang } = useT();
  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'nb' ? 'nb' : lang;
    } catch {
      /* ignore */
    }
  }, [lang]);
}

export { spokenPhrases, type SpokenPhrases } from './spoken';
