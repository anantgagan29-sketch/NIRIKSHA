import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { EN, type TranslationKey } from "@/i18n/en";
import { HI } from "@/i18n/hi";
import { LANGUAGES, RTL_LANGUAGES, findLanguage } from "@/i18n/languages";

/**
 * Interface language, held once for the whole application.
 *
 * Every visible string comes from here through `t()`, so switching language is
 * one state change rather than a per-component decision — a component asking
 * `if (language === "hi")` would be a translation that only exists where
 * somebody remembered to write it, which is how the interface ended up
 * half-translated before.
 *
 * Translating the interface is a dictionary problem and is solved here.
 * Recognising Devanagari on a package is a different and much harder problem —
 * switching this control does not make a recogniser better at reading Hindi
 * labels, and nothing in the interface implies that it does.
 *
 * Only languages with a dictionary can be selected. The selector lists the
 * others and says they are not ready, rather than switching to them and
 * leaving an English interface under a Bengali label.
 */

export type Language = string;

const DICTIONARIES: Record<string, Partial<Record<TranslationKey, string>>> = {
  en: EN,
  hi: HI,
};

const STORAGE_KEY = "niriksha.lang";

/** A language is selectable only when something is written in it. */
export function isSupported(code: string): boolean {
  return Boolean(findLanguage(code)?.supported && DICTIONARIES[code]);
}

interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => boolean;
  /**
   * Looks up a string. `vars` fills `{placeholders}` in the text, so a
   * sentence with a value in the middle stays one translatable sentence
   * instead of being glued together from fragments that no longer make
   * grammatical sense in another language.
   */
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageValue | null>(null);

function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => vars[name] ?? whole);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // A stored language whose dictionary has since been removed must not
      // strand someone in an untranslatable interface.
      return stored && isSupported(stored) ? stored : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";

    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Non-fatal: the choice still applies for this visit.
    }
  }, [language]);

  /** Returns whether the change was applied, so the caller can say why not. */
  const setLanguage = useCallback((next: Language) => {
    if (!isSupported(next)) return false;
    setLanguageState(next);
    return true;
  }, []);

  const value = useMemo<LanguageValue>(() => {
    const dictionary = DICTIONARIES[language] ?? EN;

    return {
      language,
      setLanguage,
      languages: LANGUAGES,
      t: (key, vars) => {
        const text = dictionary[key] ?? EN[key];

        // A key with no English either is a mistake in the calling code, and
        // is worth saying out loud while developing rather than rendering a
        // key name into the interface.
        if (text === undefined) {
          if (import.meta.env.DEV) console.warn(`Missing translation key: ${key}`);
          return key;
        }

        return interpolate(text, vars);
      },
    };
  }, [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside <LanguageProvider>.");
  return value;
}
