import { EN, type TranslationKey } from "@/i18n/en";
import type {
  ComplianceCheck,
  DemoProduct,
  ExtractedField,
  LetterHeightAssessment,
} from "@/data/types";

/**
 * One assessment, in the shape every export reads from.
 *
 * PDF, Word and the image report are three renderings of the same document,
 * so the decisions about what the document *says* — which fields appear, how
 * a missing value reads, what the scope paragraph is — are made once, here.
 * The exporters below decide only how it looks. Without this the three drift:
 * a field added to the PDF quietly goes missing from the Word file, and two
 * reports of the same scan stop agreeing.
 */

export interface ReportImage {
  /** Raw bytes, ready to embed. Never a URL: a linked image is not in the file. */
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface ReportField {
  label: string;
  value: string;
  /** Null where nothing was read — a confidence for a blank is meaningless. */
  confidence: number | null;
}

export type RequirementStatus = "pass" | "fail" | "review" | "not_applicable";

export interface ReportRequirement {
  label: string;
  status: RequirementStatus;
  statusLabel: string;
  requirement: string;
  finding: string;
  detected: string;
  legalReference: string;
}

/**
 * The language a report is written in.
 *
 * `t` and `label` are the interface's own translation functions, handed in
 * so the document says what the screen said. Omitted, the report is English,
 * which is what every caller before languages existed got.
 */
export interface ReportLocale {
  language: string;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  label: (kind: "field" | "check", key: string, fallback: string) => string;
  selectionLabels: (ids: string[] | null | undefined, fallbacks: string[] | undefined) => string[];
}

export const ENGLISH_LOCALE: ReportLocale = {
  language: "en",
  t: (key, vars) => {
    const text: string = EN[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (whole, name) => vars[name] ?? whole) : text;
  },
  label: (_kind, _key, fallback) => fallback,
  selectionLabels: (_ids, fallbacks) => fallbacks ?? [],
};

export interface ReportData {
  /** The language every string below is in; the renderers pick fonts by it. */
  language: string;
  /** The report's own headings, in that language. */
  strings: (key: TranslationKey, vars?: Record<string, string>) => string;
  scanReference: string;
  assessedAt: Date;
  assessedLabel: string;
  productName: string;
  netQuantity: string;
  result: "compliant" | "non_compliant" | "needs_review";
  resultLabel: string;
  score: number;
  /** Null when the scan carried no photograph, or it could not be read. */
  image: ReportImage | null;
  /** Says why, when there is no image. Printed in place of the picture. */
  imageNote: string | null;
  fields: ReportField[];
  requirements: ReportRequirement[];
  /**
   * What this assessment was asked to cover, named for a reader.
   *
   * Empty means the whole label — which is what every assessment recorded
   * before selections existed covered, and what the document has always
   * reported.
   */
  selectedFieldLabels: string[];
  /**
   * Findings the reading produced outside the request.
   *
   * A narrowed report says these exist rather than dropping them: a document
   * that quietly omits a real finding reads as one that found nothing.
   */
  findingsOutsideSelection: string[];
  scope: string;
  /** Present only for a reading the browser produced rather than the service. */
  qualification: string | null;
  /** Rule 7 findings, where the assessment produced them. */
  letterHeight: LetterHeightAssessment | null;
}

// Translation keys, resolved through the locale the report is built in.
const RESULT_LABEL: Record<string, TranslationKey> = {
  compliant: "report.compliant",
  non_compliant: "report.nonCompliant",
  needs_review: "report.needsReview",
};

const STATUS_LABEL: Record<RequirementStatus, TranslationKey> = {
  pass: "report.pass",
  fail: "report.fail",
  review: "report.review",
  not_applicable: "report.notApplicable",
};

const SCOPE =
  "This is an automated, AI-assisted preliminary assessment produced from a photograph. " +
  "It is a decision-support tool, not a statutory inspection, and it is not a government " +
  "certification. Findings require confirmation by a person before any action is taken.";

const ON_DEVICE =
  "This label was read by the browser rather than the hosted vision service, which " +
  "recognises a fraction of a photographed pack. Treat the declarations below as a " +
  "partial reading: a declaration recorded as absent may simply not have been read.";

/** The longest edge an embedded photograph is reduced to before it is stored. */
const MAX_IMAGE_EDGE = 1400;

/**
 * Reads the scan's photograph into bytes an exporter can embed.
 *
 * The image reaches this point as an object URL, which is a handle to data in
 * this tab and not something a document can reference. It is fetched, drawn
 * once at a sane size, and handed back as bytes — the same bytes for all three
 * formats, so the picture in the Word file is the picture in the PDF.
 *
 * A photograph that cannot be read is not a reason to fail: the report is
 * still worth having, and says the image was unavailable.
 */
async function loadImage(url: string | undefined): Promise<ReportImage | null> {
  if (!url) return null;

  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());

    // Aspect ratio is preserved: only the longest edge is constrained, and an
    // image already within it is left at its own size rather than upscaled.
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // PNG throughout: lossless, and the one format both pdf-lib and Word
    // accept without a second encoder.
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    if (!blob) return null;

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime: "image/png",
      width,
      height,
    };
  } catch {
    // A revoked object URL, a tainted canvas, an image that will not decode.
    // None of them should cost the reader their report.
    return null;
  }
}

function fieldOf(field: ExtractedField, locale: ReportLocale): ReportField {
  const value = (field.value ?? "").trim();

  return {
    label: locale.label("field", field.key, field.label),
    value: value || locale.t("common.notDetected"),
    confidence: value && field.confidence != null ? field.confidence : null,
  };
}

function requirementOf(check: ComplianceCheck, locale: ReportLocale): ReportRequirement {
  const status = (check.status as RequirementStatus) ?? "review";

  return {
    label: locale.label("check", check.id, check.label),
    status,
    statusLabel: STATUS_LABEL[status] ? locale.t(STATUS_LABEL[status]) : String(check.status).toUpperCase(),
    requirement: check.requirement ?? "",
    finding: check.reason ?? "",
    detected: check.detected ?? "",
    legalReference: [check.instrument, check.provision].filter(Boolean).join(" — "),
  };
}

/** Turns a finished scan into the document every exporter renders. */
export async function buildReportData(
  product: DemoProduct,
  locale: ReportLocale = ENGLISH_LOCALE,
): Promise<ReportData> {
  const assessedAt = new Date(product.scannedAt);
  const image = await loadImage(product.imageUrl);

  return {
    language: locale.language,
    strings: locale.t,
    scanReference: product.scanId,
    assessedAt,
    // The date in the reader's language and India's conventions; a locale
    // the browser lacks falls back to its default rather than throwing.
    assessedLabel: assessedAt.toLocaleString(`${locale.language}-IN`, {
      dateStyle: "full",
      timeStyle: "short",
    }),
    productName: product.name,
    netQuantity: product.netQuantity || "—",
    result: product.result,
    resultLabel: RESULT_LABEL[product.result] ? locale.t(RESULT_LABEL[product.result]) : product.result,
    score: product.score,
    image,
    imageNote: image
      ? null
      : locale.t("report.imageUnavailable"),
    // The document covers what was assessed. A requirement outside the
    // request was still computed, and is still in the scan — it is left out
    // of the report because reporting it would answer a question nobody
    // asked, and the findings summary below says it exists.
    // Only what was asked about reaches the document. The rest was still
    // assessed and is still in the scan; leaving it in would answer questions
    // nobody asked and bury the one they did.
    fields: product.fields.map((field) => fieldOf(field, locale)),
    requirements: product.checks
      .filter((check) => check.selected !== false)
      .map((check) => requirementOf(check, locale)),
    selectedFieldLabels: locale.selectionLabels(product.selectedFields, product.selectedFieldLabels),
    findingsOutsideSelection: product.findingsOutsideSelection ?? [],
    // The legal qualification in the reader's language. English keeps the
    // fuller wording below, which every translation carries in substance.
    scope: locale.language === "en" ? SCOPE : locale.t("notice.assessment"),
    qualification: product.readOnDevice ? ON_DEVICE : null,
    // Rule 7 governs the height of the lettering, which is a property of the
    // declarations themselves rather than one of them. It is not something a
    // person selects, so a narrowed assessment leaves it out: a report headed
    // with one declaration should not carry findings about the whole label.
    letterHeight: product.selectedFieldLabels?.length ? null : (product.letterHeight ?? null),
  };
}

/**
 * A filename someone can find again later.
 *
 * Everything outside letters, digits and spaces goes: a product name is read
 * off a label and arrives with slashes, quotes and rupee signs in it, any of
 * which a filesystem or a browser will object to.
 */
export function reportFilename(data: ReportData, extension: string): string {
  const name = data.productName
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);

  const date = data.assessedAt.toISOString().slice(0, 10);

  return ["Niriksha_Inspection_Report", name || "Scan", date].join("_") + "." + extension;
}

/** Hands a finished document to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
