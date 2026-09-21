import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { EN, type TranslationKey } from "@/i18n/en";
import { HI } from "@/i18n/hi";
import { BN } from "@/i18n/bn";
import { TE } from "@/i18n/te";
import { MR } from "@/i18n/mr";
import { TA } from "@/i18n/ta";
import { GU } from "@/i18n/gu";
import { KN } from "@/i18n/kn";
import { ML } from "@/i18n/ml";
import { PA } from "@/i18n/pa";
import { UR } from "@/i18n/ur";
import { AS } from "@/i18n/as";
import { OR } from "@/i18n/or";
import { SA } from "@/i18n/sa";
import { NE } from "@/i18n/ne";
import { KOK } from "@/i18n/kok";
import { MAI } from "@/i18n/mai";
import { KS } from "@/i18n/ks";
import { SD } from "@/i18n/sd";
import { DOI } from "@/i18n/doi";
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
  bn: BN,
  te: TE,
  mr: MR,
  ta: TA,
  gu: GU,
  kn: KN,
  ml: ML,
  pa: PA,
  ur: UR,
  as: AS,
  or: OR,
  sa: SA,
  ne: NE,
  kok: KOK,
  mai: MAI,
  ks: KS,
  sd: SD,
  doi: DOI,
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
  /**
   * The name of a declaration (`field.<key>`) or requirement (`check.<id>`)
   * in the interface language.
   *
   * These names arrive on the data itself, in English, from the reading
   * service. The key is what identifies them; the English label is the
   * fallback for a key no dictionary knows, so a new check on the server
   * still has a name here before anyone has translated it.
   */
  label: (kind: "field" | "check", key: string, fallback: string) => string;
  /**
   * Names a field selection for a reader. `ids` are the backend's own keys;
   * `fallbacks` are the English names it sent with them, used for a scan
   * recorded before ids were stored or for an id no dictionary knows.
   */
  selectionLabels: (ids: string[] | null | undefined, fallbacks: string[] | undefined) => string[];
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
      label: (kind, key, fallback) => {
        const text = dictionary[`${kind}.${key}` as TranslationKey] ?? EN[`${kind}.${key}` as TranslationKey];
        return text ?? fallback;
      },
      selectionLabels: (ids, fallbacks) => {
        if (!ids?.length) return fallbacks ?? [];
        return ids.map((id, index) => {
          const text = dictionary[`field.${id}` as TranslationKey] ?? EN[`field.${id}` as TranslationKey];
          return text ?? fallbacks?.[index] ?? id;
        });
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
