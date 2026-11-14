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
import { matchLang, translator, type Lang, type Translator } from './core';

export * from './core';

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
