import { EN, type TranslationKey } from "@/i18n/en";
import { DICTIONARIES } from "@/i18n/dictionaries";
import { isReportLanguage, DEFAULT_REPORT_LANGUAGE } from "@/i18n/reportLanguages";
import type { ReportLocale } from "@/services/report/model";

/**
 * The localization layer for reports.
 *
 * Built from a language code alone — not from the interface's hook — so a
 * report's language is whatever was asked for, and cannot pick up the
 * screen's language by accident. The same dictionaries serve both; only
 * the choice of which one is separate.
 *
 * Every lookup falls back to English, and a missing key is logged once so
 * a developer finds out; the reader never sees a key name or "undefined".
 */

const reported = new Set<string>();

function missing(language: string, key: string): void {
  const id = `${language}:${key}`;
  if (reported.has(id)) return;
  reported.add(id);
  if (import.meta.env.DEV) console.warn(`Report translation missing for ${language}: ${key} (English used)`);
}

function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => vars[name] ?? whole);
}

export function reportLocale(code: string): ReportLocale {
  const language = isReportLanguage(code) ? code : DEFAULT_REPORT_LANGUAGE;
  const dictionary = DICTIONARIES[language] ?? EN;

  const lookup = (key: string): string | undefined => {
    const own = dictionary[key as TranslationKey];
    if (own !== undefined) return own;
    const english = EN[key as TranslationKey];
    if (english !== undefined && language !== "en") missing(language, key);
    return english;
  };

  return {
    language,
    t: (key, vars) => {
      const text = lookup(key);
      if (text === undefined) {
        missing(language, key);
        return key;
      }
      return interpolate(text, vars);
    },
    // Declaration and requirement names carry their English label on the
    // data; the key identifies them, and an unknown key keeps that label.
    label: (kind, key, fallback) => lookup(`${kind}.${key}`) ?? fallback,
    selectionLabels: (ids, fallbacks) => {
      if (!ids?.length) return fallbacks ?? [];
      return ids.map((id, index) => lookup(`field.${id}`) ?? fallbacks?.[index] ?? id);
    },
  };
}
