import type { OcrWord } from "@/engine/domain";

/**
 * OCR provider contract.
 *
 * The engine is deliberately behind an interface. Today the only implementation
 * runs Tesseract in the browser; a server-side engine or a cloud vision API can
 * be added without any change above this line, which is what makes additional
 * languages and better engines an integration rather than a rewrite.
 */

export interface OcrOutput {
  engine: string;
  engineVersion: string;
  languages: string[];
  /** Preserved exactly as produced. Never corrected. */
  rawText: string;
  words: OcrWord[];
  meanConfidence: number;
  durationMs: number;
}

export interface OcrProgress {
  stage: string;
  /** 0-1, or null where the engine reports no measurable progress. */
  progress: number | null;
}

export interface OcrProvider {
  readonly id: string;
  readonly label: string;
  readonly languages: { code: string; label: string; note?: string }[];
  recognise(
    image: Blob | HTMLCanvasElement,
    options: { languages: string[]; onProgress?: (progress: OcrProgress) => void },
  ): Promise<OcrOutput>;
}

/** Languages exposed in the interface, with honest notes about accuracy. */
export const SUPPORTED_LANGUAGES = [
  { code: "eng", label: "English" },
  {
    code: "hin",
    label: "हिन्दी (Hindi)",
    note: "Devanagari recognition on printed packaging is markedly less accurate than English. Results are reported with confidence and should be reviewed.",
  },
] as const;
