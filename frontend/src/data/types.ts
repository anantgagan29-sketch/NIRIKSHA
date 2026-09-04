/**
 * Frontend domain model.
 *
 * These shapes are the contract between the mock service layer and every
 * component. When a real API replaces `src/services`, only the service files
 * change — nothing in `components/` or `pages/` knows where data came from.
 */

export type FieldStatus = "detected" | "needs_review" | "missing";
export type CheckStatus = "pass" | "fail" | "review" | "not_applicable";
export type ComplianceResult = "compliant" | "non_compliant" | "needs_review";
export type QualityVerdict = "good" | "marginal" | "poor";

/** A declaration read off a label, with how much the reader trusts it. */
export interface ExtractedField {
  key: string;
  label: string;
  value: string | null;
  /** 0-100. Null when the field was not found at all. */
  confidence: number | null;
  status: FieldStatus;
  /** The text the value was read from, shown as evidence. */
  evidence?: string;
}

/** One compliance rule evaluated against one package. */
export interface ComplianceCheck {
  id: string;
  fieldKey: string;
  label: string;
  status: CheckStatus;
  detected: string | null;
  confidence: number | null;
  /** What the rule requires, in plain language. */
  requirement: string;
  /** Why this outcome was reached. */
  reason: string;
  evidence?: string;
  /** The instrument and provision this rule comes from. */
  provision: string;
  instrument: string;
  severity: "critical" | "major" | "minor";
}

export interface QualityMetric {
  key: "sharpness" | "brightness" | "contrast" | "resolution" | "textVisibility";
  label: string;
  verdict: QualityVerdict;
  detail: string;
}

export interface ImageQuality {
  score: number;
  verdict: QualityVerdict;
  metrics: QualityMetric[];
  /** False when the frame is too poor to justify running recognition. */
  proceed: boolean;
  note?: string;
}

export interface DemoProduct {
  id: string;
  scanId: string;
  name: string;
  category: string;
  netQuantity: string;
  /** Drawn label, used when there is no photograph (the demo products). */
  labelLines: string[];
  /** Object URL of a real uploaded image, when this came from a live scan. */
  imageUrl?: string;
  /** True for a scan produced from a user's own image rather than a fixture. */
  isLive?: boolean;
  gtin?: string;
  result: ComplianceResult;
  score: number;
  quality: ImageQuality;
  fields: ExtractedField[];
  checks: ComplianceCheck[];
  rawText: string;
  ocrConfidence: number;
  scannedAt: string;
}

export interface ScanRecord {
  scanId: string;
  productId: string;
  product: string;
  category: string;
  result: ComplianceResult;
  score: number;
  date: string;
  relative: string;
}

export type ComplaintStatus = "submitted" | "under_review" | "verified" | "action_taken" | "rejected";

export interface ComplaintEvent {
  status: ComplaintStatus;
  at: string;
  note: string;
}

export interface Complaint {
  id: string;
  scanId: string;
  product: string;
  violationType: string;
  description: string;
  location: string;
  filedOn: string;
  status: ComplaintStatus;
  timeline: ComplaintEvent[];
}

/** The stages the inspection workspace walks through, in order. */
export type StageState = "pending" | "processing" | "complete" | "warning" | "failed";

export interface PipelineStage {
  id: string;
  index: string;
  title: string;
  description: string;
}
