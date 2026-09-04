import type { ExtractedField, ExtractionStatus, FieldKey, OcrWord } from "@/engine/domain";
import { EXTRACTORS } from "./extractors";
import { confidenceFor, normalise, spanOf } from "./text";

/**
 * Runs every extractor over one OCR result.
 *
 * Confidence is not decoration. A value read at 40% confidence is not the same
 * claim as one read at 95%, and the pipeline must carry that difference all
 * the way to the compliance verdict -- a poor read becomes NEEDS_REVIEW, never
 * a failure, because "we could not read it" is not "it is not there".
 */

/** Below this, a value is reported but not relied upon. */
export const CONFIDENCE_REVIEW_THRESHOLD = 78;

/**
 * Fields always shown to the user, whether found or not, so the absence of a
 * declaration is visible rather than silently omitted.
 */
const ALWAYS_REPORTED: { key: FieldKey; label: string }[] = [
  { key: "product_name", label: "Product name" },
  { key: "generic_name", label: "Common or generic name" },
  { key: "mrp", label: "Maximum retail price" },
  { key: "net_quantity", label: "Net quantity" },
  { key: "manufacturer_name", label: "Manufacturer / packer / importer" },
  { key: "manufacturer_address", label: "Address" },
  { key: "consumer_care", label: "Consumer care details" },
  { key: "manufacturing_date", label: "Month and year of manufacture / packing" },
  { key: "country_of_origin", label: "Country of origin" },
  { key: "best_before", label: "Best before / use by" },
  { key: "unit_sale_price", label: "Unit sale price" },
];

export interface ExtractionInput {
  scanId: string;
  rawText: string;
  words?: OcrWord[];
  meanConfidence: number;
}

export function extractFields({
  scanId,
  rawText,
  words = [],
  meanConfidence,
}: ExtractionInput): ExtractedField[] {
  const text = normalise(rawText);
  const found = new Map<FieldKey, ExtractedField>();

  for (const extractor of EXTRACTORS) {
    let candidate = null;
    try {
      candidate = extractor.run(text);
    } catch (error) {
      // One malformed pattern must not take down the whole extraction pass.
      console.error(`[niriksha] extractor ${extractor.key} failed:`, error);
      continue;
    }
    if (!candidate) continue;

    const confidence = confidenceFor(candidate.evidence, words, meanConfidence);
    const status: ExtractionStatus =
      confidence >= CONFIDENCE_REVIEW_THRESHOLD ? "DETECTED" : "NEEDS_REVIEW";

    found.set(extractor.key, {
      scanId,
      key: extractor.key,
      label: extractor.label,
      rawValue: candidate.rawValue,
      normalisedValue: candidate.normalisedValue,
      confidence,
      status,
      evidence: candidate.evidence,
      span: spanOf(text, candidate.evidence),
      extractor: candidate.extractor,
    });
  }

  const missing = ALWAYS_REPORTED.filter((entry) => !found.has(entry.key)).map<ExtractedField>(
    (entry) => ({
      scanId,
      key: entry.key,
      label: entry.label,
      confidence: 0,
      status: "NOT_FOUND",
      extractor: "none",
    }),
  );

  // Preserve the declared reporting order, then anything extra found after it.
  const ordered = ALWAYS_REPORTED.map((entry) => found.get(entry.key)).filter(
    (f): f is ExtractedField => Boolean(f),
  );
  const extras = [...found.values()].filter(
    (f) => !ALWAYS_REPORTED.some((entry) => entry.key === f.key),
  );

  return [...ordered, ...extras, ...missing];
}

export { classify, type PackageClassification } from "./classify";
