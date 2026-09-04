import type { FieldKey, OcrWord } from "@/engine/domain";
import { confidenceFor, lineContaining, normalise, spanOf } from "./text";

/**
 * Field extractors.
 *
 * Each extractor is independent, named, and returns the exact substring it
 * matched. Nothing is inferred that cannot be pointed at in the OCR output --
 * if a value cannot be evidenced, it is not extracted.
 */

export interface Candidate {
  rawValue: string;
  normalisedValue?: unknown;
  /** The OCR text supporting this value, shown to the user. */
  evidence: string;
  extractor: string;
}

export interface Extractor {
  key: FieldKey;
  label: string;
  run(text: string): Candidate | null;
}

/** Builds a candidate from a regex match, using the whole matched line as evidence. */
function fromMatch(text: string, match: RegExpMatchArray, value: string, extractor: string): Candidate {
  return {
    rawValue: value.trim(),
    evidence: lineContaining(text, match.index ?? 0) || match[0].trim(),
    extractor,
  };
}

/* ------------------------------------------------------------------ price */

const MRP_PATTERN =
  /(?:m\.?\s?r\.?\s?p\.?|max(?:imum)?\.?\s+retail\s+price|retail\s+price)\s*[:.\-]?\s*(?:rs\.?|₹|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

/** "inclusive of all taxes", in the many forms OCR returns it. */
const INCLUSIVE_PATTERN = /incl?(?:usive)?\.?\s*(?:of\s*)?all\s*tax(?:es)?/i;

export const mrpExtractor: Extractor = {
  key: "mrp",
  label: "Maximum retail price",
  run(text) {
    const match = text.match(MRP_PATTERN);
    if (!match) return null;

    const amount = Number(match[1].replace(/,/g, ""));
    // The tax-inclusive wording may wrap onto the next line, so look at a
    // window after the price rather than only at the same line.
    const window = text.slice(match.index ?? 0, (match.index ?? 0) + 140);
    const inclusive = INCLUSIVE_PATTERN.test(window);

    const candidate = fromMatch(text, match, match[0], "mrp/labelled");
    candidate.normalisedValue = {
      amount: Number.isFinite(amount) ? amount : null,
      currency: "INR",
      inclusiveOfTaxes: inclusive,
      declaredAs: match[0].trim(),
    };
    if (inclusive) {
      const taxMatch = window.match(INCLUSIVE_PATTERN);
      if (taxMatch) candidate.evidence = `${candidate.evidence} … ${taxMatch[0].trim()}`;
    }
    return candidate;
  },
};

/* --------------------------------------------------------------- quantity */

/** Units the Rules treat as standard units of weight, measure or number. */
const UNIT_CANON: Record<string, { unit: string; kind: "mass" | "volume" | "length" | "count" }> = {
  mg: { unit: "mg", kind: "mass" },
  g: { unit: "g", kind: "mass" },
  gm: { unit: "g", kind: "mass" },
  gms: { unit: "g", kind: "mass" },
  gram: { unit: "g", kind: "mass" },
  grams: { unit: "g", kind: "mass" },
  kg: { unit: "kg", kind: "mass" },
  ml: { unit: "ml", kind: "volume" },
  l: { unit: "l", kind: "volume" },
  ltr: { unit: "l", kind: "volume" },
  litre: { unit: "l", kind: "volume" },
  liter: { unit: "l", kind: "volume" },
  mm: { unit: "mm", kind: "length" },
  cm: { unit: "cm", kind: "length" },
  m: { unit: "m", kind: "length" },
  n: { unit: "N", kind: "count" },
  no: { unit: "N", kind: "count" },
  nos: { unit: "N", kind: "count" },
  pc: { unit: "N", kind: "count" },
  pcs: { unit: "N", kind: "count" },
  pieces: { unit: "N", kind: "count" },
  units: { unit: "N", kind: "count" },
};

const UNITS_ALTERNATION = Object.keys(UNIT_CANON).sort((a, b) => b.length - a.length).join("|");

const NET_QUANTITY_LABELLED = new RegExp(
  `net\\s*(?:qty|quantity|wt\\.?|weight|content|contents|vol(?:ume)?)\\s*[:.\\-]?\\s*([0-9][0-9.,]*)\\s*(${UNITS_ALTERNATION})\\b`,
  "i",
);

const NET_QUANTITY_BARE = new RegExp(`\\b([0-9][0-9.,]*)\\s*(${UNITS_ALTERNATION})\\b`, "i");

function quantityValue(rawNumber: string, rawUnit: string) {
  const value = Number(rawNumber.replace(/,/g, ""));
  const canon = UNIT_CANON[rawUnit.toLowerCase()];
  return {
    value: Number.isFinite(value) ? value : null,
    unit: canon?.unit ?? rawUnit,
    declaredUnit: rawUnit,
    kind: canon?.kind ?? null,
    isStandardUnit: Boolean(canon),
    /** Normalised to grams or millilitres, for threshold rules. */
    baseValue:
      canon && Number.isFinite(value)
        ? canon.unit === "kg"
          ? value * 1000
          : canon.unit === "l"
            ? value * 1000
            : canon.unit === "mg"
              ? value / 1000
              : value
        : null,
  };
}

export const netQuantityExtractor: Extractor = {
  key: "net_quantity",
  label: "Net quantity",
  run(text) {
    const labelled = text.match(NET_QUANTITY_LABELLED);
    if (labelled) {
      const candidate = fromMatch(text, labelled, labelled[0], "net-quantity/labelled");
      candidate.normalisedValue = { ...quantityValue(labelled[1], labelled[2]), labelled: true };
      return candidate;
    }

    // A bare "200 g" is a weaker signal: it may be a nutrition panel reference
    // rather than the net quantity declaration. It is still surfaced, but the
    // rule engine treats an unlabelled quantity as needing review.
    const bare = text.match(NET_QUANTITY_BARE);
    if (!bare) return null;

    const candidate = fromMatch(text, bare, bare[0], "net-quantity/unlabelled");
    candidate.normalisedValue = { ...quantityValue(bare[1], bare[2]), labelled: false };
    return candidate;
  },
};

/* ----------------------------------------------------------- responsible party */

const PARTY_PATTERN =
  /(manufactured\s*(?:&|and)?\s*(?:packed)?\s*by|mfd\.?\s*by|mfg\.?\s*by|packed\s*by|pkd\.?\s*by|imported\s*(?:&|and)?\s*(?:marketed)?\s*by|marketed\s*by|manufacturer|importer|packer)\s*[:.\-]?\s*/i;

function partyRole(label: string): "MANUFACTURER" | "PACKER" | "IMPORTER" | "MARKETER" {
  const l = label.toLowerCase();
  if (l.includes("import")) return "IMPORTER";
  if (l.includes("packed") || l.includes("pkd") || l.includes("packer")) return "PACKER";
  if (l.includes("market")) return "MARKETER";
  return "MANUFACTURER";
}

export const manufacturerNameExtractor: Extractor = {
  key: "manufacturer_name",
  label: "Manufacturer / packer / importer",
  run(text) {
    const match = text.match(PARTY_PATTERN);
    if (!match) return null;

    const after = text.slice((match.index ?? 0) + match[0].length);
    // The name is what follows the label, up to the end of the line or the
    // point where an address clearly begins.
    const name = after.split("\n")[0].split(/,\s*(?=\d|plot|survey|khasra|no\.)/i)[0].trim();
    if (!name || name.length < 3) return null;

    const candidate = fromMatch(text, match, name, "party/labelled");
    candidate.normalisedValue = { name, role: partyRole(match[1]), declaredAs: match[1].trim() };
    return candidate;
  },
};

/** Six-digit PIN code: the most reliable marker of an Indian postal address. */
const PIN_PATTERN = /\b([1-9][0-9]{5})\b/;

export const addressExtractor: Extractor = {
  key: "manufacturer_address",
  label: "Address",
  run(text) {
    const party = text.match(PARTY_PATTERN);
    // The address follows the responsible-party declaration, so start after
    // that line -- otherwise the party's own name is absorbed into the address.
    const partyLineEnd = party ? text.indexOf("\n", party.index ?? 0) : -1;
    const searchFrom = partyLineEnd >= 0 ? partyLineEnd + 1 : party ? (party.index ?? 0) : 0;
    const region = text.slice(searchFrom);
    const pin = region.match(PIN_PATTERN);
    if (!pin) return null;

    const pinIndex = searchFrom + (pin.index ?? 0);
    // An address is rarely one line; take the lines around the PIN code, but
    // never reach back past the party declaration we deliberately skipped.
    const start = Math.max(searchFrom, text.lastIndexOf("\n", Math.max(0, pinIndex - 80)));
    const end = text.indexOf("\n", pinIndex);
    const block = text
      .slice(start, end === -1 ? undefined : end)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", ");

    if (block.length < 10) return null;

    return {
      rawValue: block,
      normalisedValue: { address: block, pinCode: pin[1], followsPartyDeclaration: Boolean(party) },
      evidence: block,
      extractor: "address/pin-anchored",
    };
  },
};

/* ---------------------------------------------------------- consumer care */

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Indian landline, mobile and toll-free forms, tolerant of OCR spacing. */
const PHONE_PATTERN =
  /(?:\+?91[\s-]?)?(?:1800|1-800)[\s-]?[0-9]{2,4}[\s-]?[0-9]{3,4}|(?:\+?91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}|\b0?[1-9][0-9]{1,4}[\s-]?[0-9]{6,8}\b/;
const CARE_CONTEXT =
  /(consumer\s*care|customer\s*care|customer\s*service|consumer\s*complaint|for\s*(?:any\s*)?(?:complaint|queries|feedback)|helpline|toll[\s-]?free|care@|contact\s*us)/i;

export const consumerCareExtractor: Extractor = {
  key: "consumer_care",
  label: "Consumer care details",
  run(text) {
    const context = text.match(CARE_CONTEXT);
    // Search near the consumer-care wording first; an email or phone number
    // elsewhere on the pack is not necessarily a complaints contact.
    const region = context
      ? text.slice(context.index ?? 0, (context.index ?? 0) + 260)
      : text;

    const email = region.match(EMAIL_PATTERN);
    const phone = region.match(PHONE_PATTERN);
    if (!email && !phone) return null;

    const parts = [email?.[0], phone?.[0]].filter(Boolean) as string[];
    return {
      rawValue: parts.join(" · "),
      normalisedValue: {
        email: email?.[0] ?? null,
        phone: phone?.[0]?.replace(/\s+/g, " ").trim() ?? null,
        hasContextLabel: Boolean(context),
      },
      evidence: context
        ? lineContaining(text, context.index ?? 0) + (parts.length ? ` … ${parts.join(" ")}` : "")
        : parts.join(" "),
      extractor: context ? "consumer-care/labelled" : "consumer-care/unlabelled",
    };
  },
};

/* ------------------------------------------------------- country of origin */

const ORIGIN_PATTERN =
  /(?:country\s+of\s+origin|origin|made\s+in|product\s+of|manufactured\s+in)\s*[:.\-]?\s*([A-Za-z][A-Za-z .]{2,30})/i;

export const countryOfOriginExtractor: Extractor = {
  key: "country_of_origin",
  label: "Country of origin",
  run(text) {
    const match = text.match(ORIGIN_PATTERN);
    if (!match) return null;
    const country = match[1].split(/\s{2,}|[,.]/)[0].trim();
    if (country.length < 3) return null;

    const candidate = fromMatch(text, match, country, "origin/labelled");
    candidate.normalisedValue = { country, isIndia: /^india$/i.test(country) };
    return candidate;
  },
};

/* ------------------------------------------------------------------ dates */

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
/**
 * Date forms found on packaging, ordered longest-first.
 *
 * Order matters: regex alternation takes the first branch that matches at a
 * position, so the four-digit-year form must be tried before the two-digit
 * one. Getting this backwards silently truncates "04/2026" to "04/202".
 */
const MONTH_NUMBER = "(?:0?[1-9]|1[0-2])";
const DATE_VALUE = [
  // 04/2026, 15.04.2026
  `(?:[0-3]?[0-9][/.\\-]\\s?)?${MONTH_NUMBER}[/.\\-]\\s?(?:19|20)[0-9]{2}`,
  // 04/26, 15-04-26
  `(?:[0-3]?[0-9][/.\\-]\\s?)?${MONTH_NUMBER}[/.\\-]\\s?[0-9]{2}`,
  // APR 2026, April 2026, Apr-26
  `(?:${MONTHS})[\\s.\\-/]*(?:(?:19|20)[0-9]{2}|[0-9]{2})`,
  // 2026 alone, where only a year is printed
  "(?:19|20)[0-9]{2}",
].join("|");

function dateExtractor(
  key: FieldKey,
  label: string,
  labelPattern: string,
  extractorName: string,
): Extractor {
  const pattern = new RegExp(`(?:${labelPattern})\\s*[:.\\-]?\\s*(${DATE_VALUE})`, "i");
  return {
    key,
    label,
    run(text) {
      const match = text.match(pattern);
      if (!match) return null;
      const candidate = fromMatch(text, match, match[1], extractorName);
      candidate.normalisedValue = { declared: match[1].trim() };
      return candidate;
    },
  };
}

export const manufacturingDateExtractor = dateExtractor(
  "manufacturing_date",
  "Month and year of manufacture / packing",
  "mfg\\.?\\s*(?:date)?|mfd\\.?|date\\s+of\\s+(?:mfg|manufacture|manufacturing|packing|packaging)|manufactured\\s+on|packed\\s+on|pkd\\.?",
  "date/manufacture",
);

export const bestBeforeExtractor = dateExtractor(
  "best_before",
  "Best before / use by",
  "best\\s+before|use\\s+by|exp(?:iry)?\\.?\\s*(?:date)?|expires\\s+on",
  "date/best-before",
);

/* --------------------------------------------------------- unit sale price */

const UNIT_PRICE_PATTERN = new RegExp(
  `(?:unit\\s+sale\\s+price|price\\s+per\\s+unit|per\\s+(${UNITS_ALTERNATION}))\\s*[:.\\-]?\\s*(?:rs\\.?|₹|inr)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)`,
  "i",
);

export const unitSalePriceExtractor: Extractor = {
  key: "unit_sale_price",
  label: "Unit sale price",
  run(text) {
    const match = text.match(UNIT_PRICE_PATTERN);
    if (!match) return null;
    const candidate = fromMatch(text, match, match[0], "unit-price/labelled");
    candidate.normalisedValue = {
      amount: Number(match[2].replace(/,/g, "")),
      currency: "INR",
      perUnit: match[1] ?? null,
    };
    return candidate;
  },
};

/* ------------------------------------------------------------ other fields */

export const genericNameExtractor: Extractor = {
  key: "generic_name",
  label: "Common or generic name",
  run(text) {
    const match = text.match(
      /(?:common\s+name|generic\s+name|common\s+or\s+generic\s+name|product\s+type|category)\s*[:.\-]\s*([A-Za-z][A-Za-z ,'&-]{2,60})/i,
    );
    if (!match) return null;
    const candidate = fromMatch(text, match, match[1], "generic-name/labelled");
    candidate.normalisedValue = { name: match[1].trim() };
    return candidate;
  },
};

export const batchExtractor: Extractor = {
  key: "batch_number",
  label: "Batch number",
  run(text) {
    const match = text.match(
      /(?:batch|lot|b\.?\s?no\.?)\s*(?:no\.?|number|code)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\/-]{2,20})/i,
    );
    if (!match) return null;
    return fromMatch(text, match, match[1], "batch/labelled");
  },
};

export const fssaiExtractor: Extractor = {
  key: "fssai_licence",
  label: "FSSAI licence number",
  run(text) {
    const match = text.match(/(?:fssai|f\.?s\.?s\.?a\.?i\.?)[^0-9]{0,20}([0-9]{14})/i);
    if (!match) return null;
    const candidate = fromMatch(text, match, match[1], "fssai/labelled");
    candidate.normalisedValue = { licenceNumber: match[1] };
    return candidate;
  },
};

export const dimensionsExtractor: Extractor = {
  key: "dimensions",
  label: "Dimensions",
  run(text) {
    const match = text.match(
      new RegExp(`\\b([0-9]+(?:\\.[0-9]+)?)\\s*[x×]\\s*([0-9]+(?:\\.[0-9]+)?)(?:\\s*[x×]\\s*([0-9]+(?:\\.[0-9]+)?))?\\s*(mm|cm|m|in|inch)\\b`, "i"),
    );
    if (!match) return null;
    return fromMatch(text, match, match[0], "dimensions/pattern");
  },
};

/**
 * Product name has no label to anchor to, so it is a heuristic: the most
 * prominent early line that is not itself a declaration. It is reported as a
 * convenience and is never used by the rule engine.
 */
export const productNameExtractor: Extractor = {
  key: "product_name",
  label: "Product name",
  run(text) {
    const DECLARATION_NOISE =
      /(mrp|maximum|retail|net\s*(qty|quantity|wt|weight)|manufactured|packed|marketed|imported|batch|lot|best\s+before|use\s+by|mfg|fssai|consumer|customer|ingredients|nutrition|www\.|@|₹|rs\.)/i;

    const candidates = normalise(text)
      .split("\n")
      .map((line) => line.trim())
      .slice(0, 14)
      .filter(
        (line) =>
          line.length >= 4 &&
          line.length <= 48 &&
          !DECLARATION_NOISE.test(line) &&
          /[A-Za-z]{3}/.test(line) &&
          (line.match(/[0-9]/g)?.length ?? 0) <= 2,
      );

    if (candidates.length === 0) return null;
    // Prefer the line with the highest share of capital letters -- brand and
    // product names on packaging are typically set in caps or title case.
    const best = candidates.reduce((a, b) =>
      (b.match(/[A-Z]/g)?.length ?? 0) / b.length > (a.match(/[A-Z]/g)?.length ?? 0) / a.length ? b : a,
    );

    return { rawValue: best, evidence: best, extractor: "product-name/heuristic" };
  },
};

export const EXTRACTORS: Extractor[] = [
  productNameExtractor,
  genericNameExtractor,
  mrpExtractor,
  netQuantityExtractor,
  unitSalePriceExtractor,
  manufacturerNameExtractor,
  addressExtractor,
  consumerCareExtractor,
  countryOfOriginExtractor,
  manufacturingDateExtractor,
  bestBeforeExtractor,
  batchExtractor,
  fssaiExtractor,
  dimensionsExtractor,
];

export { confidenceFor, normalise, spanOf, type OcrWord };
