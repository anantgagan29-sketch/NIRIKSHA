/**
 * The shapes the NIRIKSHA FastAPI backend actually returns.
 *
 * Written from a real `POST /product/scan` response, not from a specification,
 * so the optionality here reflects what the service genuinely omits. Nothing
 * in the interface consumes these types directly — `nirikshaApi.ts` adapts
 * them into the UI model in `@/data/types`.
 */

export type BackendQualityStatus = "GOOD" | "RETAKE_REQUIRED";
export type BackendScanStatus = "SUCCESS" | "RETAKE_REQUIRED";
export type BackendComplianceStatus = "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT";

/** Per-check outcome. `DETECTED` and `NOT_DETERMINED` are not pass/fail. */
export type BackendCheckStatus = "PASS" | "FAIL" | "WARNING" | "DETECTED" | "NOT_DETERMINED";

export type BackendSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

/** Readability of one declaration, as judged from the photograph. */
export type BackendReadabilityStatus = "CLEAR" | "SMALL" | "UNCLEAR" | "NOT_DETERMINED";

export interface BackendImageQuality {
  status: BackendQualityStatus;
  score: number;
  blur_score?: number;
  brightness?: number;
  resolution?: { width: number; height: number };
  message?: string;
  retake_reason?: string[];
  retake_instructions?: string[];
  product_region?: { x: number; y: number; width: number; height: number } | null;
  quality_scope?: string;
}

/** Declarations read off the package. Every field may legitimately be null. */
export interface BackendProduct {
  product_name?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  packer?: string | null;
  address?: string | null;
  mrp?: string | null;
  net_quantity?: string | null;
  manufacturing_date?: string | null;
  /** A pre-packing date (PKD / "Packed On"), which Rule 6(1)(d) accepts in
   *  place of a manufacturing date. */
  packing_date?: string | null;
  expiry_date?: string | null;
  best_before?: string | null;
  /** A shelf life stated as a duration, e.g. "6 Months from PKD". */
  shelf_life?: string | null;
  batch_number?: string | null;
  license_number?: string | null;
  consumer_care_phone?: string | null;
  consumer_care_email?: string | null;
  country_of_origin?: string | null;
  unit_sale_price?: string | null;
  other_dates?: string[];
  other_declarations?: string[];
  /** Present only on the fallback path, when vision parsing degraded to text. */
  raw_ocr_text?: string | null;
}

export interface BackendReadabilityField {
  status: BackendReadabilityStatus;
  confidence?: number | null;
  /** [x, y, width, height] in source-image pixels, when locatable. */
  bounding_box?: number[] | null;
  reason?: string | null;
}

export interface BackendReadability {
  overall_status?: string;
  fields?: Record<string, BackendReadabilityField>;
  physical_font_size?: { status?: string; message?: string };
  note?: string;
}

export interface BackendCheck {
  status: BackendCheckStatus;
  /** String, object or array depending on the check. Stringified for display. */
  value?: unknown;
  message?: string;
  rule?: string;
  severity?: BackendSeverity;
}

export interface BackendCompliance {
  status: BackendComplianceStatus;
  score: number;
  rule_set?: string;
  checks?: Record<string, BackendCheck>;
  required_checks?: string[];
  missing_declarations?: string[];
  violations?: string[];
  warnings?: string[];
  /** Date declarations sorted into what each one is, keeping the text printed
   *  on the pack alongside the normalised value. */
  normalized_dates?: {
    manufacturing_date?: NormalisedDate | null;
    packing_date?: NormalisedDate | null;
    expiry_date?: NormalisedDate | null;
    best_before_date?: NormalisedDate | null;
    shelf_life?: {
      original: string;
      amount: number;
      unit: string;
      reference?: string | null;
      approx_days: number;
    } | null;
    unparsed?: string[];
    date_declaration_present?: boolean;
    shelf_life_declaration_present?: boolean;
  };
  /** Requirements not applied to this package, with the provision that
   *  exempts it. An exemption is not a finding of compliance. */
  exemptions?: {
    rule: string;
    net_quantity?: string | null;
    suppressed_checks: string[];
    note: string;
  }[];
  recommendations?: string[];
  inspection_summary?: {
    total_required_checks?: number;
    passed_checks?: number;
    failed_checks?: number;
    warnings_count?: number;
    violations_count?: number;
  };
  note?: string;
}

export interface BackendVisualEvidence {
  field: string;
  compliance_check?: string;
  status?: string;
  readability?: BackendReadabilityStatus;
  confidence?: number | null;
  bounding_box?: number[] | null;
  reason?: string | null;
  compliance_message?: string | null;
}

/** The complete `POST /product/scan` response. */
export interface BackendScanResponse {
  /** Present on list rows; a stored scan detail does not carry it. */
  created_at?: string;
  filename?: string;
  image_quality: BackendImageQuality;
  scan_status: BackendScanStatus;
  product: BackendProduct | null;
  compliance: BackendCompliance | null;
  readability: BackendReadability | null;
  visual_evidence?: BackendVisualEvidence[];
  /** Present only when the scan stopped at the quality gate. */
  message?: string;
  photo_guidance?: { title: string; tips: string[] };
}

export interface NormalisedDate {
  /** The text as printed on the package. */
  original: string;
  iso: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  /** How precisely the date was stated: "day", "month" or "year". A pack
   *  stating only month and year is doing what Rule 6(1)(d) asks. */
  precision: "day" | "month" | "year" | null;
}
