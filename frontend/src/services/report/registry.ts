import { HAS_BACKEND, registerReportGeneration } from "@/services/nirikshaApi";

/**
 * Tells the server a report was made, and in which language.
 *
 * Fire-and-forget by design. The document is already in the reader's
 * hands when this runs; the record is for the history — which language a
 * scan was last reported in — and for reproducing the report later. A demo
 * product has no server-side scan to annotate, and a server that cannot be
 * reached costs the reader nothing.
 */
export async function registerReport(scanId: string, language: string, format: string): Promise<void> {
  if (!HAS_BACKEND || !scanId || !/^SCN|^NIR|^[0-9A-Za-z-]+$/.test(scanId)) return;

  try {
    await registerReportGeneration(scanId, language, format);
  } catch (cause) {
    console.info("Report generation was not recorded on the server.", cause);
  }
}
