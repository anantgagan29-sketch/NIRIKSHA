/**
 * The languages NIRIKSHA lists, and which of them it can actually speak.
 *
 * Every language here is offered in the selector, but only those marked
 * `supported` have a translation behind them. The rest say so plainly instead
 * of switching to a half-English interface and leaving someone to work out
 * that the translation was never written — an application about honest
 * labelling should not mislabel itself.
 *
 * Every dictionary is generated from `scripts/i18n/<code>.py` by
 * `scripts/i18n_gen.py`, which refuses to emit one that lacks a key English
 * has. The eighteen beyond English and Hindi were written for this release and
 * still want a native speaker's read before anyone relies on their wording.
 *
 * Adding a language later is a two-step change: set `supported` here, and add
 * its dictionary in this folder. Nothing else in the interface needs touching.
 */

export interface LanguageOption {
  code: string;
  /** The language's own name, as its speakers write it. */
  native: string;
  /** The English name, for readers who cannot read the native script. */
  english: string;
  supported: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", native: "English", english: "English", supported: true },
  { code: "hi", native: "हिन्दी", english: "Hindi", supported: true },
  { code: "bn", native: "বাংলা", english: "Bengali", supported: true },
  { code: "te", native: "తెలుగు", english: "Telugu", supported: true },
  { code: "mr", native: "मराठी", english: "Marathi", supported: true },
  { code: "ta", native: "தமிழ்", english: "Tamil", supported: true },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", supported: true },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", supported: true },
  { code: "ml", native: "മലയാളം", english: "Malayalam", supported: true },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", supported: true },
  { code: "ur", native: "اردو", english: "Urdu", supported: true },
  { code: "as", native: "অসমীয়া", english: "Assamese", supported: true },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", supported: true },
  { code: "sa", native: "संस्कृत", english: "Sanskrit", supported: true },
  { code: "ne", native: "नेपाली", english: "Nepali", supported: true },
  { code: "kok", native: "कोंकणी", english: "Konkani", supported: true },
  { code: "mai", native: "मैथिली", english: "Maithili", supported: true },
  { code: "ks", native: "कॉशुर", english: "Kashmiri", supported: true },
  { code: "sd", native: "सिन्धी", english: "Sindhi", supported: true },
  { code: "doi", native: "डोगरी", english: "Dogri", supported: true },
];

/**
 * Urdu is written right to left; the interface has to follow the script.
 * Sindhi and Kashmiri are offered in their Devanagari orthography here, so
 * they read left to right like the rest.
 */
export const RTL_LANGUAGES = new Set(["ur"]);

export function findLanguage(code: string): LanguageOption | undefined {
  return LANGUAGES.find((language) => language.code === code);
}
