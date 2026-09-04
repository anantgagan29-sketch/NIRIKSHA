import { DEMO_PRODUCTS, getDemoProduct, getDemoProductByScanId } from "@/data/demoProducts";
import { SCAN_HISTORY, SCAN_STATS } from "@/data/scanHistory";
import { COMPLAINTS } from "@/data/complaints";
import type { Complaint, ComplaintStatus, DemoProduct, ScanRecord } from "@/data/types";
import * as backend from "./nirikshaApi";

/**
 * Mock service layer.
 *
 * Every component reads data through this module and nothing else. It is
 * deliberately async and deliberately slow in places, so the interface is
 * built against the timing a real pipeline would have rather than against
 * instant local values.
 *
 * ── Where the data comes from ─────────────────────────────────────────────
 * When VITE_API_BASE_URL is set, history and complaints come from the NIRIKSHA
 * API through `nirikshaApi.ts`; the sample products stay local because they
 * exist to demonstrate the interface, not to stand in for real records.
 *
 * Without an API configured, everything falls back to the local fixtures so
 * the interface still runs end to end.
 *
 *   listScans            → GET    /scans
 *   getScanStats         → GET    /scans/stats
 *   listComplaints       → GET    /complaints
 *   submitComplaint      → POST   /complaints
 *   updateComplaintStatus→ PATCH  /complaints/:id
 *
 * The inspection itself is one call — POST /product/scan — issued from
 * `useInspection`, because the backend runs the whole pipeline in one pass.
 */

/** True while no API is configured, so the interface can say so honestly. */
export { USING_MOCK_DATA as IS_DEMO_DATA } from "./config";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------- inspection */

export async function listProducts(): Promise<DemoProduct[]> {
  await wait(120);
  return DEMO_PRODUCTS;
}

export async function getProduct(id: string): Promise<DemoProduct | null> {
  await wait(120);
  return getDemoProduct(id);
}

export async function getProductByScanId(scanId: string): Promise<DemoProduct | null> {
  await wait(120);
  return getDemoProductByScanId(scanId);
}

export async function analyseQuality(productId: string) {
  await wait(900);
  return getDemoProduct(productId)?.quality ?? null;
}

export async function runOcr(productId: string) {
  await wait(1600);
  const product = getDemoProduct(productId);
  return product ? { rawText: product.rawText, confidence: product.ocrConfidence } : null;
}

export async function extractFields(productId: string) {
  await wait(900);
  return getDemoProduct(productId)?.fields ?? [];
}

export async function runCompliance(productId: string) {
  await wait(800);
  const product = getDemoProduct(productId);
  if (!product) return null;
  return { result: product.result, score: product.score, checks: product.checks };
}

/* ---------------------------------------------------------------- history */

export async function listScans(): Promise<ScanRecord[]> {
  if (backend.HAS_BACKEND) return backend.listScans();
  await wait(150);
  return SCAN_HISTORY;
}

export async function getScanStats() {
  if (backend.HAS_BACKEND) return backend.scanStats();
  await wait(80);
  return SCAN_STATS;
}

/* ------------------------------------------------------------- complaints */

export async function listComplaints(): Promise<Complaint[]> {
  if (backend.HAS_BACKEND) return backend.listComplaints();
  await wait(150);
  return COMPLAINTS;
}

export interface ComplaintDraft {
  productId: string;
  violationType: string;
  description: string;
  location: string;
  additional?: string;
  /** Set when the complaint is raised against a real scan. */
  scanId?: string;
  productName?: string;
}

/**
 * Records a complaint locally and issues a reference number.
 *
 * This does not transmit anything. NIRIKSHA is not connected to a government
 * complaint portal, and the interface says so wherever a complaint is shown.
 */
export async function submitComplaint(draft: ComplaintDraft): Promise<Complaint> {
  if (backend.HAS_BACKEND) {
    return backend.createComplaint({
      scanId: draft.scanId,
      product: draft.productName ?? getDemoProduct(draft.productId)?.name,
      violationType: draft.violationType,
      description: draft.description,
      location: draft.location,
      contact: draft.additional,
    });
  }

  await wait(1100);

  const product = getDemoProduct(draft.productId);
  const sequence = String(482 + COMPLAINTS.length).padStart(5, "0");

  return {
    id: `NIR-CMP-2026-${sequence}`,
    scanId: product?.scanId ?? "—",
    product: product?.name ?? "Unidentified product",
    violationType: draft.violationType,
    description: draft.description,
    location: draft.location || "Not provided",
    filedOn: new Date().toISOString(),
    status: "submitted",
    timeline: [
      {
        status: "submitted",
        at: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
        note: "Complaint recorded in the NIRIKSHA system with the assessment findings attached.",
      },
    ],
  };
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus, note?: string) {
  if (backend.HAS_BACKEND) return backend.updateComplaintStatus(id, status, note);
  await wait(500);
  return { id, status };
}
