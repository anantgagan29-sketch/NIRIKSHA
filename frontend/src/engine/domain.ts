/**
 * Core NIRIKSHA domain vocabulary.
 *
 * These types are the contract between every stage of the pipeline:
 *   image -> quality -> ocr -> extraction -> classification -> rules -> result
 *
 * Nothing here may import React, Next or the DOM. The compliance engine is a
 * pure library so it can be unit-tested and reasoned about independently of
 * the interface that happens to be calling it.
 */

/* ------------------------------------------------------------------ people */

export const ROLES = ["CITIZEN", "INSPECTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

/** Safe projection of a user for any client-facing payload. */
export type PublicUser = Omit<User, "passwordHash">;

/* ----------------------------------------------------------------- product */

/**
 * Provenance of a product record. Deliberately explicit: NIRIKSHA has no
 * connection to any government registry, and the UI must never imply one.
 */
export const PRODUCT_SOURCES = ["PROTOTYPE_DB", "USER_ENTERED", "OCR_DERIVED"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PACKAGE_TYPES = ["RETAIL", "WHOLESALE", "MULTI_PIECE", "UNKNOWN"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export interface Product {
  id: string;
  gtin?: string;
  name: string;
  category?: string;
  isImported: boolean;
  isFoodArticle: boolean;
  packageType: PackageType;
  source: ProductSource;
  createdAt: string;
}

/* -------------------------------------------------------------------- scan */

export const SCAN_MODES = ["LIVE", "DEMO"] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

export const SCAN_STATUSES = [
  "CREATED",
  "QUALITY_CHECKED",
  "QUALITY_REJECTED",
  "OCR_DONE",
  "EXTRACTED",
  "ASSESSED",
  "FAILED",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** Metres, as reported by the browser. Used to avoid implying false precision. */
  accuracy?: number;
}

export interface Scan {
  id: string;
  userId?: string;
  productId?: string;
  imageKey: string;
  imageHash: string;
  mimeType: string;
  byteSize: number;
  status: ScanStatus;
  mode: ScanMode;
  location?: GeoPoint;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------------------------------------------- quality */

export const QUALITY_VERDICTS = ["GOOD", "MARGINAL", "POOR"] as const;
export type QualityVerdict = (typeof QUALITY_VERDICTS)[number];

/** One measured dimension of image quality, with the threshold it was judged against. */
export interface QualityMetric {
  key: "sharpness" | "brightness" | "contrast" | "resolution" | "textVisibility";
  label: string;
  /** Raw measured value, in the metric's own units. */
  value: number;
  /** Normalised 0-1 score derived from value and thresholds. */
  score: number;
  verdict: QualityVerdict;
  /** Human-readable explanation of what was measured and why it passed or failed. */
  detail: string;
}

export interface ImageQuality {
  scanId: string;
  metrics: QualityMetric[];
  verdict: QualityVerdict;
  /** Overall 0-100, derived from the metrics. Never a fabricated constant. */
  score: number;
  /** Why the image was rejected or flagged, in plain language. */
  reasons: string[];
  /** False when the image is too poor to justify running OCR at all. */
  proceedToOcr: boolean;
  widthPx: number;
  heightPx: number;
  analysedAt: string;
}

/* --------------------------------------------------------------------- ocr */

export interface OcrWord {
  text: string;
  /** 0-100 as reported by the engine. */
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  scanId: string;
  engine: string;
  engineVersion: string;
  languages: string[];
  /** Preserved verbatim. Never the only thing shown, never silently corrected. */
  rawText: string;
  words: OcrWord[];
  meanConfidence: number;
  durationMs: number;
  completedAt: string;
}

/* -------------------------------------------------------------- extraction */

export const FIELD_KEYS = [
  "product_name",
  "generic_name",
  "mrp",
  "net_quantity",
  "unit_sale_price",
  "manufacturer_name",
  "manufacturer_address",
  "manufacturer_role",
  "consumer_care",
  "country_of_origin",
  "manufacturing_date",
  "best_before",
  "batch_number",
  "dimensions",
  "fssai_licence",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const EXTRACTION_STATUSES = ["DETECTED", "NEEDS_REVIEW", "NOT_FOUND"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export interface ExtractedField {
  scanId: string;
  key: FieldKey;
  label: string;
  /** Exactly as it appeared in the OCR text. */
  rawValue?: string;
  /** Parsed/canonicalised form, e.g. { amount: 50, currency: "INR" }. */
  normalisedValue?: unknown;
  /** 0-100. Derived from OCR word confidences over the matched span. */
  confidence: number;
  status: ExtractionStatus;
  /** The OCR substring the extractor matched, shown to the user as evidence. */
  evidence?: string;
  /** Character offsets into OcrResult.rawText, for highlighting. */
  span?: { start: number; end: number };
  /** Which extractor produced this, for debugging and auditability. */
  extractor: string;
}

/* ------------------------------------------------------------- rule engine */

export const RULE_STATUSES = ["PASS", "FAIL", "NOT_APPLICABLE", "NEEDS_REVIEW"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "INFO"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const OVERALL_STATUSES = ["COMPLIANT", "NON_COMPLIANT", "NEEDS_REVIEW"] as const;
export type OverallStatus = (typeof OVERALL_STATUSES)[number];

/** A citation to the instrument a rule comes from. Required on every rule. */
export interface RuleSource {
  /** e.g. "Legal Metrology (Packaged Commodities) Rules, 2011" */
  instrument: string;
  /** e.g. "Rule 6(1)(e)" */
  provision: string;
  url?: string;
  /** When the provision as encoded took effect, where known. */
  effectiveDate?: string;
  /** Set when the citation has not yet been verified against source text. */
  unverified?: boolean;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  fieldKey?: FieldKey;
  status: RuleStatus;
  severity: Severity;
  /** Why this outcome was reached, in language a citizen can read. */
  reason: string;
  /** What the rule required. */
  expected: string;
  /** What was actually found, if anything. */
  detected?: string;
  /** The OCR fragment supporting the outcome. */
  evidence?: string;
  source: RuleSource;
  /** Present when status is NOT_APPLICABLE, explaining the condition that excluded it. */
  notApplicableReason?: string;
}

export interface ComplianceRun {
  scanId: string;
  rulePackVersion: string;
  engineVersion: string;
  overallStatus: OverallStatus;
  /**
   * 0-100 system assessment. Explicitly NOT a legal determination, and the UI
   * must always render it alongside that qualification.
   */
  score: number;
  counts: Record<RuleStatus, number>;
  results: RuleResult[];
  assessedAt: string;
  durationMs: number;
}

/* -------------------------------------------------------------- complaints */

export const COMPLAINT_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "ACTION_TAKEN",
  "REJECTED",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface Complaint {
  id: string;
  /** Citizen-facing reference, e.g. NIR-2026-7Q4KD2. */
  refNo: string;
  scanId: string;
  userId?: string;
  status: ComplaintStatus;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  location?: GeoPoint;
  assignedToId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Append-only audit trail behind every complaint status change. */
export interface ComplaintEvent {
  id: string;
  complaintId: string;
  fromStatus?: ComplaintStatus;
  toStatus: ComplaintStatus;
  actorId?: string;
  note?: string;
  createdAt: string;
}

/* ----------------------------------------------------------------- reports */

export interface Report {
  id: string;
  scanId: string;
  complaintId?: string;
  pdfKey: string;
  generatedAt: string;
}

/* ------------------------------------------------------- assembled result */

/** Everything known about one scan, as returned by GET /api/scans/:id. */
export interface ScanDetail {
  scan: Scan;
  quality?: ImageQuality;
  ocr?: OcrResult;
  fields: ExtractedField[];
  compliance?: ComplianceRun;
  complaint?: Complaint;
  product?: Product;
}
