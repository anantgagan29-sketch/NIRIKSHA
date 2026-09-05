import { API_BASE_URL, FORCE_CLIENT_PIPELINE, USING_MOCK_DATA, apiUrl } from "./config";
import { supabase } from "./supabase";
import type {
  BackendCheck,
  BackendProduct,
  BackendReadability,
  BackendScanResponse,
} from "./backendTypes";
import type {
  Complaint,
  ComplaintStatus,
  ComplianceCheck,
  ComplianceResult,
  ExtractedField,
  FieldStatus,
  ImageQuality,
  QualityMetric,
  QualityVerdict,
  ScanRecord,
} from "@/data/types";

/**
 * The NIRIKSHA API client.
 *
 * This is the only module that speaks HTTP, and the only place the backend's
 * vocabulary appears. Everything it returns is already in the UI's own model
 * (`@/data/types`), so no page or component has to know that the shapes on the
 * wire look different from the shapes on screen.
 *
 * Adapting here rather than in components is deliberate: when the backend
 * changes a field name, exactly one file changes.
 */

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The hosted vision service could not answer.
 *
 * Distinct from ApiError because it is not a failure to report to the user:
 * the label can still be read on this device, so the caller's response is to
 * take that path rather than to show an error.
 */
export class AiUnavailableError extends Error {
  /** Which models declined and why, for the console — never for the screen. */
  readonly models: Record<string, string>;
  constructor(message: string, models: Record<string, string> = {}) {
    super(message);
    this.name = "AiUnavailableError";
    this.models = models;
  }
}

/* ------------------------------------------------------------- transport */

/**
 * The current session's access token, or null when nobody is signed in.
 *
 * Every call that touches a user's own data carries this. The API verifies the
 * signature and reads the user id out of the token, which is why the browser
 * never sends an id of its own: a value the client can type is a value the
 * client can change, and scan history is exactly the thing that must not be
 * readable by naming someone else.
 */
async function accessToken(): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();

  return data.session?.access_token ?? null;
}

/** The Authorization header for a signed-in caller, or nothing. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await accessToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  const headers = {
    ...(await authHeaders()),
    ...(init?.headers as Record<string, string> | undefined),
  };

  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch (cause) {
    // An aborted request is the caller's own doing, not a failure to report.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      `Could not reach the NIRIKSHA server at ${API_BASE_URL}. Check that the backend is running.`,
    );
  }

  if (!response.ok) {
    // FastAPI puts human-readable failures in `detail`.
    let detail = `The server returned ${response.status}.`;
    try {
      const body = await response.json();

      // The server says its vision models are the thing that is unavailable.
      // That is a routing decision for the caller, not a message for the user.
      if (body?.detail?.code === "AI_UNAVAILABLE") {
        throw new AiUnavailableError(body.detail.message ?? detail, body.detail.models ?? {});
      }

      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail) && body.detail[0]?.msg) detail = body.detail[0].msg;
    } catch (cause) {
      if (cause instanceof AiUnavailableError) throw cause;
      // A non-JSON error body leaves the status-based message in place.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Whether the API should handle recognition and compliance.
 *
 * False when no backend is configured, and also when the in-browser pipeline
 * has been forced — in both cases the local engine takes over.
 */
export const HAS_BACKEND = !USING_MOCK_DATA && !FORCE_CLIENT_PIPELINE;

export async function checkHealth(): Promise<boolean> {
  if (USING_MOCK_DATA) return false;
  try {
    const body = await request<{ status?: string }>("/health");
    return body.status === "healthy";
  } catch {
    return false;
  }
}

/* --------------------------------------------------------- value display */

/**
 * Renders a check's `value` for display.
 *
 * The backend returns a string for some checks, a structured object for others
 * (the party check carries manufacturer/packer/importer; the unit-price check
 * carries its whole calculation), and an array for the screening checks.
 */
function describeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : null;

  if (Array.isArray(value)) {
    const parts = value.map(describeValue).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      // Absent and false entries say "not detected"; showing them as noise
      // would bury whatever the check actually found.
      .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== "")
      .map(([key, v]) => `${humanise(key)}: ${describeValue(v) ?? "—"}`);
    return parts.length ? parts.join(" · ") : null;
  }

  return null;
}

function humanise(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/, (c) => c.toUpperCase())
    .replace(/\bmrp\b/i, "MRP");
}

/** "Rule 6(11) - unit sale price" → "Rule 6(11)" */
function provisionOf(rule: string | undefined): string {
  if (!rule) return "—";
  const head = rule.split(/\s+[-–—]\s+/)[0]?.trim();
  return head || rule;
}

/* -------------------------------------------------------- image quality */

const BLUR_GOOD = 80;
const BLUR_POOR = 40;

function grade(value: number, poor: number, good: number): QualityVerdict {
  return value < poor ? "poor" : value < good ? "marginal" : "good";
}

function adaptQuality(source: BackendScanResponse["image_quality"]): ImageQuality {
  const metrics: QualityMetric[] = [];

  if (typeof source.blur_score === "number") {
    const blur = source.blur_score;
    metrics.push({
      key: "sharpness",
      label: "Sharpness",
      verdict: grade(blur, BLUR_POOR, BLUR_GOOD),
      detail:
        blur < BLUR_POOR
          ? `Blur score ${blur}. The product image is too blurred for the small print to be read reliably.`
          : blur < BLUR_GOOD
            ? `Blur score ${blur}. Edges are soft; fine print may be misread.`
            : `Blur score ${blur}. Edges are crisp.`,
    });
  }

  if (typeof source.brightness === "number") {
    const b = source.brightness;
    const verdict: QualityVerdict =
      b < 45 || b > 240 ? "poor" : b < 65 || b > 225 ? "marginal" : "good";
    metrics.push({
      key: "brightness",
      label: "Brightness",
      verdict,
      detail:
        b < 65
          ? `Mean brightness ${b}. The product is dark; dark areas lose character strokes.`
          : b > 225
            ? `Mean brightness ${b}. The product is over-lit; bright areas lose detail.`
            : `Mean brightness ${b}, within the readable range.`,
    });
  }

  if (source.resolution) {
    const { width, height } = source.resolution;
    const region = source.product_region;
    const shorter = region ? Math.min(region.width, region.height) : Math.min(width, height);
    metrics.push({
      key: "resolution",
      label: "Resolution",
      verdict: grade(shorter, 300, 400),
      detail: region
        ? `${width} × ${height} px, with the package occupying ${region.width} × ${region.height} px. Quality was measured on the package, not the whole photo.`
        : `${width} × ${height} px. The package could not be isolated, so the whole photo was measured.`,
    });
  }

  const proceed = source.status === "GOOD";
  const reasons = source.retake_reason ?? [];

  return {
    score: source.score,
    // A passing frame that still raised concerns is marginal, not good: the
    // backend proceeds, but the interface should say the reading is softer.
    verdict: proceed ? (reasons.length > 0 ? "marginal" : "good") : "poor",
    metrics,
    proceed,
    note: proceed && reasons.length > 0 ? reasons.join(" ") : undefined,
  };
}

/* ------------------------------------------------------------ declarations */

/** Product fields, in reporting order, with the readability key that scores them. */
/**
 * `group` marks fields that are alternative ways of making the same
 * declaration. A pack states its date as MFG *or* PKD, and its shelf life as
 * an expiry date, a best-before date *or* a duration — declaring one does not
 * leave the others missing. Only the alternatives actually found are listed,
 * and when a group is empty its first member is shown so the gap is still
 * visible.
 */
const FIELD_MAP: {
  key: keyof BackendProduct;
  label: string;
  readability?: string;
  group?: string;
}[] = [
  { key: "product_name", label: "Product Name", readability: "product_name" },
  { key: "brand", label: "Brand" },
  { key: "mrp", label: "MRP", readability: "mrp" },
  { key: "net_quantity", label: "Net Quantity", readability: "net_quantity" },
  { key: "unit_sale_price", label: "Unit Sale Price", readability: "unit_sale_price" },
  { key: "manufacturer", label: "Manufacturer", readability: "manufacturer_or_packer" },
  { key: "packer", label: "Packer", readability: "manufacturer_or_packer" },
  { key: "address", label: "Address", readability: "manufacturer_or_packer" },
  { key: "consumer_care_phone", label: "Consumer Care — Phone", readability: "consumer_care" },
  { key: "consumer_care_email", label: "Consumer Care — Email", readability: "consumer_care" },
  { key: "manufacturing_date", label: "Manufacturing Date", readability: "manufacturing_date", group: "date" },
  { key: "packing_date", label: "Packing Date", readability: "manufacturing_date", group: "date" },
  { key: "expiry_date", label: "Expiry / Use By", readability: "expiry_or_use_by", group: "shelf" },
  { key: "best_before", label: "Best Before", readability: "expiry_or_use_by", group: "shelf" },
  { key: "shelf_life", label: "Shelf Life", readability: "expiry_or_use_by", group: "shelf" },
  { key: "batch_number", label: "Batch Number", readability: "batch_number" },
  { key: "license_number", label: "Licence Number" },
  { key: "country_of_origin", label: "Country of Origin", readability: "country_of_origin" },
];

function adaptFields(
  product: BackendProduct | null,
  readability: BackendReadability | null,
): ExtractedField[] {
  if (!product) return [];
  const scores = readability?.fields ?? {};

  const fields: ExtractedField[] = FIELD_MAP.map(({ key, label, readability: rKey }) => {
    const raw = product[key];
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    const score = rKey ? scores[rKey] : undefined;

    // Confidence is the readability model's certainty about the printed text,
    // so it only means anything when there is a value to be certain about.
    const confidence =
      value && typeof score?.confidence === "number" ? Math.round(score.confidence * 100) : null;

    // A value the model itself calls small or unclear is reported for review
    // rather than presented as read — the same rule the interface already
    // applies to low-confidence readings.
    const status: FieldStatus = !value
      ? "missing"
      : score?.status === "SMALL" || score?.status === "UNCLEAR" || (confidence !== null && confidence < 70)
        ? "needs_review"
        : "detected";

    return {
      key: String(key),
      label,
      value,
      confidence,
      status,
      evidence: value && score?.reason ? score.reason : undefined,
    };
  });

  // Collapse each alternatives group down to what the pack actually declares.
  const groups = new Set(
    FIELD_MAP.map((entry) => entry.group).filter((g): g is string => Boolean(g)),
  );

  for (const group of groups) {
    const members = FIELD_MAP.filter((entry) => entry.group === group);
    const keys = new Set(members.map((entry) => String(entry.key)));
    const found = fields.filter((f) => keys.has(f.key) && f.status !== "missing");

    // Keep the first member as the visible gap when nothing in the group was
    // declared; otherwise keep only the alternatives that were.
    const keep = new Set(
      found.length ? found.map((f) => f.key) : [String(members[0].key)],
    );

    for (let i = fields.length - 1; i >= 0; i -= 1) {
      if (keys.has(fields[i].key) && !keep.has(fields[i].key)) fields.splice(i, 1);
    }
  }

  // Anything the model saw but had no named slot for.
  for (const declaration of product.other_declarations ?? []) {
    fields.push({
      key: `other:${declaration}`,
      label: "Other Declaration",
      value: declaration,
      confidence: null,
      status: "detected",
    });
  }

  return fields;
}

/* -------------------------------------------------------------- checks */

const CHECK_LABELS: Record<string, string> = {
  manufacturer_or_packer: "Manufacturer, packer or importer declared",
  generic_product_name: "Common or generic name declared",
  net_quantity: "Net quantity declared",
  mrp: "Retail sale price declared",
  consumer_care_details: "Consumer care contact declared",
  manufacturing_date: "Month and year of manufacture or packing",
  best_before_or_use_by: "Best before or use by date",
  batch_number: "Batch or lot number",
  country_of_origin: "Country of origin",
  unit_sale_price: "Unit sale price declared",
  unit_price_consistency: "Unit sale price consistent with MRP and quantity",
  font_size_readability: "Declarations legible at the required size",
  misleading_declarations: "No misleading declarations detected",
  non_standard_declarations: "No non-standard declaration formats detected",
  dimensions: "Dimensions of the commodity",
};

/** Which declaration a check is about, so the UI can link the two. */
const CHECK_FIELD: Record<string, string> = {
  manufacturer_or_packer: "manufacturer",
  generic_product_name: "product_name",
  net_quantity: "net_quantity",
  mrp: "mrp",
  consumer_care_details: "consumer_care_phone",
  manufacturing_date: "manufacturing_date",
  best_before_or_use_by: "expiry_date",
  batch_number: "batch_number",
  country_of_origin: "country_of_origin",
  unit_sale_price: "unit_sale_price",
};

function adaptCheckStatus(status: BackendCheck["status"]): ComplianceCheck["status"] {
  switch (status) {
    case "PASS":
    case "DETECTED":
      return "pass";
    case "FAIL":
      return "fail";
    case "WARNING":
      return "review";
    // The backend says NOT_DETERMINED when applicability itself is unresolved.
    // That is a question for a person, not a failure against the product.
    case "NOT_DETERMINED":
    default:
      return "review";
  }
}

function adaptSeverity(severity: BackendCheck["severity"]): ComplianceCheck["severity"] {
  switch (severity) {
    case "HIGH":
      return "critical";
    case "MEDIUM":
      return "major";
    default:
      return "minor";
  }
}

function adaptChecks(
  compliance: BackendScanResponse["compliance"],
  readability: BackendReadability | null,
): ComplianceCheck[] {
  if (!compliance?.checks) return [];
  const instrument = compliance.rule_set ?? "Legal Metrology (Packaged Commodities) Rules, 2011";
  const scores = readability?.fields ?? {};

  return Object.entries(compliance.checks).map(([name, check]) => {
    const fieldKey = CHECK_FIELD[name] ?? "";
    const score = scores[name] ?? scores[fieldKey];

    return {
      id: name,
      fieldKey,
      label: CHECK_LABELS[name] ?? humanise(name),
      status: adaptCheckStatus(check.status),
      detected: describeValue(check.value),
      confidence: typeof score?.confidence === "number" ? Math.round(score.confidence * 100) : null,
      requirement: check.rule ?? "—",
      reason: check.message ?? "No explanation was returned for this check.",
      evidence: score?.reason ?? undefined,
      provision: provisionOf(check.rule),
      instrument,
      severity: adaptSeverity(check.severity),
    };
  });
}

const RESULT_MAP: Record<string, ComplianceResult> = {
  COMPLIANT: "compliant",
  PARTIALLY_COMPLIANT: "needs_review",
  NON_COMPLIANT: "non_compliant",
};

/* ------------------------------------------------------------ the scan */

export interface ScanOutcome {
  /** False when the backend stopped at the quality gate. */
  proceeded: boolean;
  quality: ImageQuality;
  fields: ExtractedField[];
  checks: ComplianceCheck[];
  result: ComplianceResult | null;
  score: number;
  productName: string | null;
  netQuantity: string | null;
  rawText?: string;
  /** Guidance the backend supplies when it asks for a retake. */
  retakeTips: string[];
  /** The backend's own qualification of what this assessment is. */
  note?: string;
  raw: BackendScanResponse;
}

/**
 * Runs one image through the backend's full pipeline.
 *
 * The backend does quality analysis, vision parsing, readability scoring and
 * the compliance rules in a single call, so this is one request rather than
 * the staged sequence the mock service exposes.
 */
export async function scanProduct(
  file: File,
  signal?: AbortSignal,
  /**
   * Identifies this scan action. Sent again with the same value -- a retry,
   * or a submit that fired twice -- the server returns the reference it
   * already issued instead of recording a second scan.
   */
  eventId?: string,
): Promise<ScanOutcome> {
  const form = new FormData();
  form.append("file", file);
  if (eventId) form.append("scan_event_id", eventId);

  const body = await request<BackendScanResponse>("/product/scan", {
    method: "POST",
    body: form,
    signal,
  });

  const quality = adaptQuality(body.image_quality);
  const proceeded = body.scan_status === "SUCCESS";

  return {
    proceeded,
    quality,
    fields: adaptFields(body.product, body.readability),
    checks: adaptChecks(body.compliance, body.readability),
    result: body.compliance ? (RESULT_MAP[body.compliance.status] ?? "needs_review") : null,
    score: body.compliance?.score ?? 0,
    productName: body.product?.product_name?.trim() || null,
    netQuantity: body.product?.net_quantity?.trim() || null,
    rawText: body.product?.raw_ocr_text ?? undefined,
    retakeTips: body.photo_guidance?.tips ?? body.image_quality.retake_instructions ?? [],
    note: body.compliance?.note,
    raw: body,
  };
}

/* ------------------------------------------------------------- history */

interface BackendScanRow {
  id: string;
  created_at: string;
  filename?: string | null;
  product_name?: string | null;
  net_quantity?: string | null;
  scan_status: string;
  status?: string | null;
  score?: number | null;
}

/** "Today, 10:24 AM" / "3 days ago, 06:40 PM" */
function relativeTime(iso: string): string {
  const then = new Date(iso);
  const time = then.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);

  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${days} days ago, ${time}`;
}

export async function listScans(): Promise<ScanRecord[]> {
  const body = await request<{ items: BackendScanRow[] }>("/scans");

  return body.items.map((row) => ({
    scanId: row.id,
    productId: row.id,
    // A rejected photograph has no product to name; say what it was instead of
    // leaving the row blank.
    product:
      row.product_name?.trim() ||
      (row.scan_status === "RETAKE_REQUIRED" ? "Photo rejected — retake required" : "Unidentified product"),
    category: row.net_quantity?.trim() || "—",
    result:
      row.scan_status === "RETAKE_REQUIRED"
        ? "needs_review"
        : (RESULT_MAP[row.status ?? ""] ?? "needs_review"),
    score: row.score ?? 0,
    date: row.created_at,
    relative: relativeTime(row.created_at),
  }));
}

export interface ScanStats {
  inspected: number;
  compliant: number;
  nonCompliant: number;
  needsReview: number;
  retakeRequired?: number;
  complaints: number;
}

export async function scanStats(): Promise<ScanStats> {
  return request<ScanStats>("/scans/stats");
}

/** The full stored response for one past scan, adapted for the result screens. */
export async function getScan(scanId: string): Promise<ScanOutcome> {
  const body = await request<BackendScanResponse>(`/scans/${encodeURIComponent(scanId)}`);
  const quality = adaptQuality(body.image_quality);

  return {
    proceeded: body.scan_status === "SUCCESS",
    quality,
    fields: adaptFields(body.product, body.readability),
    checks: adaptChecks(body.compliance, body.readability),
    result: body.compliance ? (RESULT_MAP[body.compliance.status] ?? "needs_review") : null,
    score: body.compliance?.score ?? 0,
    productName: body.product?.product_name?.trim() || null,
    netQuantity: body.product?.net_quantity?.trim() || null,
    rawText: body.product?.raw_ocr_text ?? undefined,
    retakeTips: body.photo_guidance?.tips ?? body.image_quality.retake_instructions ?? [],
    note: body.compliance?.note,
    raw: body,
  };
}

/* ---------------------------------------------------------- complaints */

interface BackendComplaint {
  id: string;
  scan_id?: string | null;
  product?: string | null;
  violation_type: string;
  description: string;
  location?: string | null;
  contact?: string | null;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  timeline: { status: ComplaintStatus; note?: string | null; created_at: string }[];
}

function adaptComplaint(source: BackendComplaint): Complaint {
  return {
    id: source.id,
    scanId: source.scan_id ?? "—",
    product: source.product?.trim() || "Unidentified product",
    violationType: source.violation_type,
    description: source.description,
    location: source.location?.trim() || "Not provided",
    filedOn: source.created_at,
    status: source.status,
    timeline: source.timeline.map((event) => ({
      status: event.status,
      at: new Date(event.created_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      note: event.note ?? "",
    })),
  };
}

export async function listComplaints(): Promise<Complaint[]> {
  const body = await request<{ items: BackendComplaint[] }>("/complaints");
  return body.items.map(adaptComplaint);
}

export interface ComplaintPayload {
  scanId?: string;
  product?: string;
  violationType: string;
  description: string;
  location?: string;
  contact?: string;
}

export async function createComplaint(payload: ComplaintPayload): Promise<Complaint> {
  const body = await request<BackendComplaint>("/complaints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scan_id: payload.scanId ?? null,
      product: payload.product ?? null,
      violation_type: payload.violationType,
      description: payload.description,
      location: payload.location || null,
      contact: payload.contact || null,
    }),
  });
  return adaptComplaint(body);
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note?: string,
): Promise<Complaint> {
  const body = await request<BackendComplaint>(`/complaints/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note: note || null }),
  });
  return adaptComplaint(body);
}


/* ------------------------------------------------------------- barcode */

export interface BarcodeLookup {
  barcode: string;
  /** False when a check digit does not match — the code was misread. */
  valid: boolean;
  reason?: string | null;
  /** The GS1 member organisation that issued the prefix, where known. */
  issuing_region?: string | null;
  found: boolean;
  product_name?: string | null;
  source?: string | null;
  message?: string;
}

/**
 * Asks the backend what is known about a scanned barcode.
 *
 * Identification is optional to the workflow: the caller is expected to carry
 * on with the image inspection whether this succeeds, fails, or reports that
 * nothing is known. It throws only on a transport failure, which the caller
 * treats as "lookup unavailable" rather than as an error worth stopping for.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  return request<BarcodeLookup>("/barcode/lookup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ barcode }),
  });
}
