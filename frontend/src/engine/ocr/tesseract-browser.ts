"use client";

import type { OcrOutput, OcrProgress, OcrProvider } from "./provider";
import { SUPPORTED_LANGUAGES } from "./provider";
import type { OcrWord } from "@/engine/domain";
import { prepareForOcr } from "./preprocess";

/**
 * Tesseract, compiled to WebAssembly, running in the browser.
 *
 * Running recognition on the device keeps large images off the network until
 * they are known to be worth uploading, costs no server time per scan, and
 * degrades gracefully on a poor connection. The engine is the real Tesseract,
 * not an approximation of it, and it reports genuine per-word confidence.
 */

let workerPromise: Promise<unknown> | null = null;
let workerLanguages = "";

async function getWorker(languages: string[], onProgress?: (p: OcrProgress) => void) {
  const key = languages.join("+");
  const { createWorker } = await import("tesseract.js");

  // Loading language data is the slow part, so the worker is reused between
  // scans unless the requested languages change.
  if (!workerPromise || workerLanguages !== key) {
    workerLanguages = key;
    workerPromise = createWorker(languages, undefined, {
      logger: (message: { status?: string; progress?: number }) => {
        onProgress?.({
          stage: message.status ?? "working",
          progress: typeof message.progress === "number" ? message.progress : null,
        });
      },
    });
  }
  return workerPromise;
}

/** Word-level detail moved between shapes across Tesseract versions. */
function collectWords(data: Record<string, unknown>): OcrWord[] {
  const words: OcrWord[] = [];

  const push = (word: Record<string, unknown>) => {
    const text = typeof word.text === "string" ? word.text.trim() : "";
    const confidence = typeof word.confidence === "number" ? word.confidence : 0;
    if (!text) return;
    const bbox = word.bbox as OcrWord["bbox"] | undefined;
    words.push({ text, confidence, bbox });
  };

  if (Array.isArray(data.words)) {
    for (const word of data.words) push(word as Record<string, unknown>);
    return words;
  }

  // Newer builds nest words under blocks -> paragraphs -> lines.
  for (const block of (data.blocks as Record<string, unknown>[] | undefined) ?? []) {
    for (const paragraph of (block.paragraphs as Record<string, unknown>[] | undefined) ?? []) {
      for (const line of (paragraph.lines as Record<string, unknown>[] | undefined) ?? []) {
        for (const word of (line.words as Record<string, unknown>[] | undefined) ?? []) {
          push(word);
        }
      }
    }
  }
  return words;
}

export const tesseractBrowserProvider: OcrProvider = {
  id: "tesseract.js",
  label: "Tesseract (in-browser)",
  languages: [...SUPPORTED_LANGUAGES],

  async recognise(image, { languages, onProgress }) {
    const startedAt = performance.now();
    const worker = (await getWorker(languages, onProgress)) as {
      recognize: (
        image: Blob | HTMLCanvasElement,
        options?: unknown,
        output?: unknown,
      ) => Promise<{ data: Record<string, unknown> }>;
    };

    // A phone photograph is corrected before recognition. Without this the
    // engine is handed an underexposed frame and reports, correctly, that it
    // could barely read it.
    let input: Blob | HTMLCanvasElement = image;

    if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
      const prepared = prepareForOcr(image);
      input = prepared.canvas;
      console.info("OCR preprocessing:", prepared.notes.join("; "));
    }

    const { data } = await worker.recognize(input, {}, { blocks: true, text: true });

    const rawText = typeof data.text === "string" ? data.text : "";
    const words = collectWords(data);

    // Prefer the mean of the word confidences the engine actually reported; the
    // document-level figure is a fallback, not a substitute.
    const meanConfidence =
      words.length > 0
        ? words.reduce((total, word) => total + word.confidence, 0) / words.length
        : typeof data.confidence === "number"
          ? data.confidence
          : 0;

    return {
      engine: "tesseract.js",
      engineVersion: "7",
      languages,
      rawText,
      words,
      meanConfidence: Math.round(meanConfidence),
      durationMs: Math.round(performance.now() - startedAt),
    } satisfies OcrOutput;
  },
};

/** Releases the worker and its language data. */
export async function terminateOcr() {
  if (!workerPromise) return;
  const worker = (await workerPromise) as { terminate?: () => Promise<void> };
  await worker.terminate?.();
  workerPromise = null;
  workerLanguages = "";
}
