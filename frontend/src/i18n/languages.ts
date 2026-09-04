/**
 * The languages NIRIKSHA lists, and which of them it can actually speak.
 *
 * Every language here is offered in the selector, but only those marked
 * `supported` have a translation behind them. The rest say so plainly instead
 * of switching to a half-English interface and leaving someone to work out
 * that the translation was never written — an application about honest
 * labelling should not mislabel itself.
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
  { code: "bn", native: "বাংলা", english: "Bengali", supported: false },
  { code: "te", native: "తెలుగు", english: "Telugu", supported: false },
  { code: "mr", native: "मराठी", english: "Marathi", supported: false },
  { code: "ta", native: "தமிழ்", english: "Tamil", supported: false },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", supported: false },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", supported: false },
  { code: "ml", native: "മലയാളം", english: "Malayalam", supported: false },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", supported: false },
  { code: "ur", native: "اردو", english: "Urdu", supported: false },
  { code: "as", native: "অসমীয়া", english: "Assamese", supported: false },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", supported: false },
  { code: "sa", native: "संस्कृत", english: "Sanskrit", supported: false },
  { code: "ne", native: "नेपाली", english: "Nepali", supported: false },
  { code: "kok", native: "कोंकणी", english: "Konkani", supported: false },
  { code: "mai", native: "मैथिली", english: "Maithili", supported: false },
  { code: "ks", native: "कश्मीरी", english: "Kashmiri", supported: false },
  { code: "sd", native: "सिंधी", english: "Sindhi", supported: false },
  { code: "doi", native: "डोगरी", english: "Dogri", supported: false },
];

/** Urdu is written right to left; the interface has to follow the script. */
export const RTL_LANGUAGES = new Set(["ur", "sd"]);

export function findLanguage(code: string): LanguageOption | undefined {
  return LANGUAGES.find((language) => language.code === code);
}
