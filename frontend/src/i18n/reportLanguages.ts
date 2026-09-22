import { LANGUAGES } from "./languages";

/**
 * The languages a report can be written in.
 *
 * Separate from the interface language on purpose: a Hindi-speaking
 * inspector may need an English document for a file, and an English
 * interface may need a Tamil report for the shopkeeper it is about. The two
 * choices never read from each other — the report language is asked for
 * every time a report is made, and remembered only as a default for the
 * next one.
 *
 * Derived from the interface language list so a language written once is
 * offered everywhere. The server keeps the same list and checks it.
 */

export interface ReportLanguage {
  code: string;
  /** The English name, for filenames, logs and readers of another script. */
  name: string;
  /** The language's own name, as its speakers write it. */
  nativeName: string;
}

export const REPORT_LANGUAGES: ReportLanguage[] = LANGUAGES.filter((l) => l.supported).map((l) => ({
  code: l.code,
  name: l.english,
  nativeName: l.native,
}));

export const DEFAULT_REPORT_LANGUAGE = "en";

export function isReportLanguage(code: string | null | undefined): code is string {
  return Boolean(code && REPORT_LANGUAGES.some((l) => l.code === code));
}

export function reportLanguage(code: string): ReportLanguage {
  return REPORT_LANGUAGES.find((l) => l.code === code) ?? REPORT_LANGUAGES[0];
}

const STORAGE_KEY = "niriksha.reportLang";

/**
 * The language the last report was made in — the default offered next time,
 * never applied without asking. Not the interface language: that is a
 * different setting and is not consulted here.
 */
export function rememberedReportLanguage(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isReportLanguage(stored) ? stored : DEFAULT_REPORT_LANGUAGE;
  } catch {
    return DEFAULT_REPORT_LANGUAGE;
  }
}

export function rememberReportLanguage(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // The choice still applies to this report.
  }
}
