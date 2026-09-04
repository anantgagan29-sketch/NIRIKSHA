import { assessQuality } from "@/engine/vision/quality";
import { decodeImage } from "@/engine/vision/browser";
import { extractFields } from "@/engine/extraction";
import { assessCompliance } from "@/engine/compliance/engine";
import { tesseractBrowserProvider } from "@/engine/ocr/tesseract-browser";
import type {
  ComplianceCheck,
  ComplianceResult,
  ExtractedField,
  FieldStatus,
  ImageQuality,
  QualityMetric,
  QualityVerdict,
} from "@/data/types";
import type {
  ComplianceRun,
  ExtractedField as EngineField,
  ImageQuality as EngineQuality,
  RuleResult,
  Severity,
} from "@/engine/domain";

/**
 * Live inspection of an image the user actually supplied.
 *
 * Everything here runs in the browser: the quality analysis is a real
 * convolution over the decoded pixels, the recognition is Tesseract compiled
 * to WebAssembly, and the extraction and rule engine are the same pure
 * TypeScript modules the full pipeline uses. No server is involved at any
 * point, which is why this belongs in a frontend-only build.
 *
 * The demo products remain on the fixture path in `inspectionService.ts`; this
 * module is only reached when someone uploads or photographs a label.
 */

/* --------------------------------------------------- engine → UI adapters */

const VERDICT: Record<string, QualityVerdict> = {
  GOOD: "good",
  MARGINAL: "marginal",
  POOR: "poor",
};

const FIELD_STATUS: Record<string, FieldStatus> = {
  DETECTED: "detected",
  NEEDS_REVIEW: "needs_review",
  NOT_FOUND: "missing",
};

const CHECK_STATUS = {
  PASS: "pass",
  FAIL: "fail",
  NEEDS_REVIEW: "review",
  NOT_APPLICABLE: "not_applicable",
} as const;

const RESULT: Record<string, ComplianceResult> = {
  COMPLIANT: "compliant",
  NON_COMPLIANT: "non_compliant",
  NEEDS_REVIEW: "needs_review",
};

const SEVERITY: Record<Severity, ComplianceCheck["severity"]> = {
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
  INFO: "minor",
};

function toQuality(engine: Omit<EngineQuality, "scanId"> & { measurements?: unknown }): ImageQuality {
  const metrics: QualityMetric[] = engine.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    verdict: VERDICT[metric.verdict],
    detail: metric.detail,
  }));

  return {
    score: engine.score,
    verdict: VERDICT[engine.verdict],
    metrics,
    proceed: engine.proceedToOcr,
    note: engine.reasons.length > 0 && engine.proceedToOcr ? engine.reasons[0] : undefined,
  };
}

function toField(field: EngineField): ExtractedField {
  return {
    key: field.key,
    label: field.label,
    value: field.rawValue ?? null,
    confidence: field.status === "NOT_FOUND" ? null : field.confidence,
    status: FIELD_STATUS[field.status],
    evidence: field.evidence,
  };
}

function toCheck(result: RuleResult, index: number): ComplianceCheck {
  return {
    id: result.ruleId || `rule-${index}`,
    fieldKey: result.fieldKey ?? "",
    label: result.ruleName,
    status: CHECK_STATUS[result.status],
    detected: result.detected ?? null,
    confidence: null,
    requirement: result.expected,
    reason: result.reason,
    evidence: result.evidence,
    provision: result.source.provision,
    instrument: result.source.instrument,
    severity: SEVERITY[result.severity],
  };
}

/* ------------------------------------------------------------- the stages */

export interface DecodedUpload {
  canvas: HTMLCanvasElement;
  previewUrl: string;
  width: number;
  height: number;
  quality: ImageQuality;
}

/**
 * Decodes the image and measures it. Real numbers: variance of the Laplacian
 * for sharpness, clipping and mean luminance for exposure, luminance spread
 * for contrast, and edge density as a proxy for text being present at all.
 */
export async function inspectUpload(file: File): Promise<DecodedUpload> {
  const decoded = await decodeImage(file);
  const assessment = assessQuality(decoded.raster);

  // Resolution must be judged on what the camera captured, not on the working
  // copy the analysis was run against.
  assessment.widthPx = decoded.naturalWidth;
  assessment.heightPx = decoded.naturalHeight;

  return {
    canvas: decoded.canvas,
    previewUrl: URL.createObjectURL(file),
    width: decoded.naturalWidth,
    height: decoded.naturalHeight,
    quality: toQuality(assessment),
  };
}

export interface LiveOcr {
  rawText: string;
  confidence: number;
  durationMs: number;
  engine: string;
}

/** Runs Tesseract on the decoded canvas, reporting progress as it goes. */
export async function recogniseUpload(
  canvas: HTMLCanvasElement,
  languages: string[],
  onProgress?: (fraction: number) => void,
): Promise<LiveOcr> {
  const output = await tesseractBrowserProvider.recognise(canvas, {
    languages,
    onProgress: ({ stage, progress }) => {
      if (stage === "recognizing text" && progress !== null) onProgress?.(progress);
    },
  });

  return {
    rawText: output.rawText,
    confidence: output.meanConfidence,
    durationMs: output.durationMs,
    engine: output.engine,
  };
}

export interface LiveAssessment {
  fields: ExtractedField[];
  checks: ComplianceCheck[];
  result: ComplianceResult;
  score: number;
}

/** Structured extraction and the rule engine, both pure and both in-browser. */
export function assessUpload(rawText: string, confidence: number): LiveAssessment {
  const engineFields = extractFields({
    scanId: "live",
    rawText,
    meanConfidence: confidence,
  });

  const run: ComplianceRun = assessCompliance({
    scanId: "live",
    rawText,
    fields: engineFields,
    meanConfidence: confidence,
  });

  return {
    fields: engineFields.map(toField),
    checks: run.results.map(toCheck),
    result: RESULT[run.overallStatus],
    score: run.score,
  };
}
