import { EN, type TranslationKey } from "./en";
import { HI } from "./hi";
import { BN } from "./bn";
import { TE } from "./te";
import { MR } from "./mr";
import { TA } from "./ta";
import { GU } from "./gu";
import { KN } from "./kn";
import { ML } from "./ml";
import { PA } from "./pa";
import { UR } from "./ur";
import { AS } from "./as";
import { OR } from "./or";
import { SA } from "./sa";
import { NE } from "./ne";
import { KOK } from "./kok";
import { MAI } from "./mai";
import { KS } from "./ks";
import { SD } from "./sd";
import { DOI } from "./doi";

/**
 * Every dictionary the application has, by language code.
 *
 * One registry, read by both the interface (useLanguage) and the report
 * writers (services/report/locale), so a language added here is available
 * to both at once and neither can drift from the other.
 */
export const DICTIONARIES: Record<string, Partial<Record<TranslationKey, string>>> = {
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
