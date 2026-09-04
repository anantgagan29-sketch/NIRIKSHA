import type { ExtractedField, PackageType } from "@/engine/domain";
import { normalise } from "./text";

/**
 * Package classification.
 *
 * Which declarations a package must carry depends on what kind of package it
 * is. Classifying before validating is what allows a requirement to be marked
 * not applicable instead of failed -- a domestic package is not deficient for
 * lacking a country of origin declaration.
 *
 * Every signal is recorded so the user can see why the system decided a rule
 * did or did not apply.
 */

export interface PackageClassification {
  packageType: PackageType;
  isImported: boolean;
  isFoodArticle: boolean;
  /** Net quantity normalised to grams or millilitres, where determinable. */
  netQuantityBase: number | null;
  netQuantityKind: "mass" | "volume" | "length" | "count" | null;
  /** Human-readable evidence for each conclusion. */
  signals: string[];
  /** True when nothing in the text settled the question either way. */
  uncertain: string[];
}

const IMPORT_SIGNALS = /(imported\s*(?:&|and)?\s*(?:marketed)?\s*by|importer|country\s+of\s+origin)/i;
const FOOD_SIGNALS =
  /(fssai|ingredients|nutritional\s+information|nutrition\s+facts|energy\s*\(?kcal|best\s+before|use\s+by|allergen|contains\s+added|veg(?:etarian)?\s+logo)/i;
const NON_RETAIL_SIGNALS =
  /(not\s+for\s+retail\s+sale|for\s+institutional\s+use|for\s+industrial\s+use|wholesale\s+package|bulk\s+pack)/i;

function field(fields: ExtractedField[], key: string) {
  return fields.find((f) => f.key === key && f.status !== "NOT_FOUND");
}

export function classify(rawText: string, fields: ExtractedField[]): PackageClassification {
  const text = normalise(rawText);
  const signals: string[] = [];
  const uncertain: string[] = [];

  /* imported ------------------------------------------------------------- */
  const party = field(fields, "manufacturer_name");
  const partyRole = (party?.normalisedValue as { role?: string } | undefined)?.role;
  const origin = field(fields, "country_of_origin");
  const originValue = origin?.normalisedValue as { country?: string; isIndia?: boolean } | undefined;

  let isImported = false;
  if (partyRole === "IMPORTER") {
    isImported = true;
    signals.push("Declared as imported: the responsible party is stated as an importer.");
  } else if (originValue?.country && originValue.isIndia === false) {
    isImported = true;
    signals.push(`Declared country of origin is ${originValue.country}, outside India.`);
  } else if (IMPORT_SIGNALS.test(text) && !originValue?.isIndia) {
    isImported = true;
    signals.push("Import-related wording found on the label.");
  } else {
    signals.push("No import indication found; treated as a domestic package.");
    uncertain.push(
      "Import status was inferred from the label text alone. If this is an imported package whose importer declaration was not read, origin rules may not have been applied.",
    );
  }

  /* food article --------------------------------------------------------- */
  const isFoodArticle = FOOD_SIGNALS.test(text);
  signals.push(
    isFoodArticle
      ? "Food-article indicators found (for example an FSSAI number, ingredients or nutrition panel)."
      : "No food-article indicators found; food labelling requirements were not applied.",
  );

  /* package type --------------------------------------------------------- */
  const packageType: PackageType = NON_RETAIL_SIGNALS.test(text) ? "WHOLESALE" : "RETAIL";
  signals.push(
    packageType === "RETAIL"
      ? "Treated as a retail package intended for the ultimate consumer."
      : "Wording suggests this is not a retail package intended for the ultimate consumer.",
  );

  /* quantity ------------------------------------------------------------- */
  const quantity = field(fields, "net_quantity")?.normalisedValue as
    | { baseValue?: number | null; kind?: "mass" | "volume" | "length" | "count" | null }
    | undefined;

  return {
    packageType,
    isImported,
    isFoodArticle,
    netQuantityBase: quantity?.baseValue ?? null,
    netQuantityKind: quantity?.kind ?? null,
    signals,
    uncertain,
  };
}
