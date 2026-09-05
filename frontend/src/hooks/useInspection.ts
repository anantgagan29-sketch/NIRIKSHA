import { useCallback, useRef, useState } from "react";
import { PIPELINE_STAGES } from "@/data/pipeline";
import * as api from "@/services/inspectionService";
import { assessUpload, inspectUpload, recogniseUpload } from "@/services/liveInspection";
import { AiUnavailableError, HAS_BACKEND, scanProduct } from "@/services/nirikshaApi";
import type {
  ComplianceCheck,
  ComplianceResult,
  DemoProduct,
  ExtractedField,
  ImageQuality,
  LetterHeightAssessment,
  StageState,
} from "@/data/types";

/**
 * Drives one inspection through the pipeline.
 *
 * Two sources feed the same stage machine:
 *
 *   • a DEMO product, whose results come from fixtures through the service
 *     layer — used for a reliable walkthrough;
 *   • a LIVE upload.
 *
 * The live path always measures the image in the browser first — that gate is
 * instant, works offline, and stops an unreadable photo before it costs a
 * round trip. What happens after it depends on configuration:
 *
 *   • with a backend (VITE_API_BASE_URL set), the image goes to
 *     `POST /product/scan`, which runs vision parsing, readability scoring and
 *     the compliance rules server-side and returns all of it at once;
 *   • without one, the in-browser engine under `src/engine` does the same work
 *     locally.
 *
 * All three produce identical state, so every component downstream is unaware
 * of which one it is rendering.
 */

export type Phase = "idle" | "quality" | "blocked" | "running" | "done" | "error";
export type Source = "demo" | "live";

export interface InspectionState {
  phase: Phase;
  source: Source;
  product: DemoProduct | null;
  /** Object URL for an uploaded image; null on the demo path. */
  preview: string | null;
  imageSize: { width: number; height: number } | null;
  stages: Record<string, StageState>;
  quality: ImageQuality | null;
  fields: ExtractedField[];
  checks: ComplianceCheck[];
  result: ComplianceResult | null;
  score: number;
  rawText: string;
  ocrConfidence: number;
  /** 0-100 across the whole pipeline. */
  progress: number;
  /** True while a single long server request is in flight, so the bar can
   *  show that work is happening without inventing a percentage. */
  serverBusy: boolean;
  /** Retake guidance supplied by the server when it rejects an image. */
  retakeTips: string[];
  /** The backend's own qualification of what the assessment is. */
  assessmentNote?: string;
  /** Product name as read by the server, used to title the scan. */
  productLabel?: string | null;
  /** Rule 7 findings from the server pass, where there are any. */
  letterHeight?: LetterHeightAssessment | null;
  /**
   * True when the reading came from the in-browser engine instead of the
   * hosted models. It is a genuine fallback, not an equivalent: Tesseract on
   * a phone photograph reads a fraction of what the vision service reads, and
   * a screen that does not say so invites a bad reading to be mistaken for a
   * finding about the package.
   */
  readOnDevice: boolean;
  error: string | null;
}

const IDLE_STAGES = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, "pending" as StageState]));

const INITIAL: InspectionState = {
  phase: "idle",
  source: "demo",
  product: null,
  preview: null,
  imageSize: null,
  stages: IDLE_STAGES,
  quality: null,
  fields: [],
  checks: [],
  result: null,
  score: 0,
  rawText: "",
  ocrConfidence: 0,
  progress: 0,
  serverBusy: false,
  retakeTips: [],
  readOnDevice: false,
  error: null,
};

export function useInspection() {
  const [state, setState] = useState<InspectionState>(INITIAL);
  const cancelled = useRef(false);
  /** The decoded upload, kept out of state: it is a DOM node, not data. */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<string | null>(null);
  /** The original file, needed when the backend does the recognition. */
  const fileRef = useRef<File | null>(null);
  /**
   * Identifies the scan action currently in progress. Held across retries of
   * the same run so the server can recognise a repeat, and cleared whenever a
   * new image is chosen -- that is a different action and deserves its own
   * record.
   */
  const eventId = useRef<string | null>(null);

  const patch = useCallback((next: Partial<InspectionState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const setStage = useCallback((id: string, value: StageState) => {
    setState((current) => ({ ...current, stages: { ...current.stages, [id]: value } }));
  }, []);

  const reset = useCallback(() => {
    cancelled.current = true;
    // Object URLs hold the whole image in memory until they are revoked.
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    canvasRef.current = null;
    fileRef.current = null;
    eventId.current = null;
    setState({ ...INITIAL, stages: { ...IDLE_STAGES } });
  }, []);

  /* ------------------------------------------------------------ demo path */

  const startDemo = useCallback(
    async (productId: string) => {
      cancelled.current = false;
      const product = await api.getProduct(productId);
      if (!product) {
        patch({ phase: "error", error: "That product could not be loaded." });
        return;
      }

      setState({
        ...INITIAL,
        stages: { ...IDLE_STAGES, quality: "processing" },
        source: "demo",
        product,
        phase: "quality",
        progress: 8,
      });

      const quality = await api.analyseQuality(productId);
      if (cancelled.current || !quality) return;

      setState((current) => ({
        ...current,
        quality,
        progress: 22,
        phase: quality.proceed ? "quality" : "blocked",
        stages: {
          ...current.stages,
          quality: quality.proceed ? (quality.verdict === "marginal" ? "warning" : "complete") : "failed",
        },
      }));
    },
    [patch],
  );

  /* ------------------------------------------------------------ live path */

  /**
   * Decodes a real image and measures it. Nothing is recognised yet — the
   * quality gate decides whether recognition is worth running at all.
   */
  const startUpload = useCallback(
    async (file: File) => {
      cancelled.current = false;
      eventId.current = null;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);

      setState({
        ...INITIAL,
        stages: { ...IDLE_STAGES, quality: "processing" },
        source: "live",
        phase: "quality",
        progress: 8,
      });

      try {
        const decoded = await inspectUpload(file);
        if (cancelled.current) {
          URL.revokeObjectURL(decoded.previewUrl);
          return;
        }

        canvasRef.current = decoded.canvas;
        previewRef.current = decoded.previewUrl;
        fileRef.current = file;

        setState((current) => ({
          ...current,
          preview: decoded.previewUrl,
          imageSize: { width: decoded.width, height: decoded.height },
          quality: decoded.quality,
          progress: 22,
          phase: decoded.quality.proceed ? "quality" : "blocked",
          stages: {
            ...current.stages,
            quality: decoded.quality.proceed
              ? decoded.quality.verdict === "marginal"
                ? "warning"
                : "complete"
              : "failed",
          },
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          phase: "error",
          stages: { ...current.stages, quality: "failed" },
          error:
            error instanceof Error
              ? error.message
              : "This image could not be opened. It may be corrupted or in an unsupported format.",
        }));
      }
    },
    [],
  );

  /* ------------------------------------------- stages two through six */

  const runPipeline = useCallback(
    async (languages: string[] = ["eng"]) => {
      cancelled.current = false;

      // One identifier per scan action, minted here and reused if this run is
      // retried. The server records the first request under it and answers a
      // repeat with the same reference, so a submit that fires twice leaves
      // one row rather than two identical ones minutes apart.
      //
      // Deliberately scanning the same packet again starts a new run and
      // mints a new id: the identity is the action, never the product.
      if (!eventId.current) eventId.current = crypto.randomUUID();

      patch({ phase: "running" });

      try {
        /* ------------------------------------------------ server pipeline */
        if (state.source === "live" && HAS_BACKEND) {
          const file = fileRef.current;
          if (!file) throw new Error("The image is no longer available. Please upload it again.");

          // One request covers vision parsing, readability and the rules, so
          // there are no intermediate milestones to report. Every server-side
          // stage is marked processing for the duration rather than being
          // ticked off on a guess.
          for (const id of ["vision", "ocr", "fields", "rules"]) setStage(id, "processing");
          patch({ serverBusy: true });

          // When the hosted models cannot answer, this is not an error to
          // show. The device can read the label itself: the pipeline below
          // runs OCR here, extracts the same declarations and applies the
          // same Legal Metrology rules, so the inspection still completes.
          let outcome: Awaited<ReturnType<typeof scanProduct>> | null = null;

          try {
            outcome = await scanProduct(file, undefined, eventId.current ?? undefined);
          } catch (error) {
            if (!(error instanceof AiUnavailableError)) throw error;
            console.info("Hosted vision unavailable; reading the label on this device.", error.models);
            patch({ serverBusy: false });
          }

          if (cancelled.current) return;

          if (outcome) {

          // The server runs its own quality gate and may reject an image the
          // browser check passed. Its verdict wins.
          if (!outcome.proceeded) {
            setState((current) => ({
              ...current,
              phase: "blocked",
              serverBusy: false,
              quality: outcome.quality,
              retakeTips: outcome.retakeTips,
              progress: 22,
              stages: { ...IDLE_STAGES, quality: "failed" },
            }));
            return;
          }

          const needsReview = outcome.fields.some((field) => field.status === "needs_review");

          setStage("vision", "complete");
          setStage("ocr", "complete");
          setStage("fields", needsReview ? "warning" : "complete");
          setStage("rules", "complete");
          setStage(
            "result",
            outcome.result === "compliant"
              ? "complete"
              : outcome.result === "needs_review"
                ? "warning"
                : "failed",
          );

          patch({
            serverBusy: false,
            readOnDevice: false,
            quality: outcome.quality,
            fields: outcome.fields,
            checks: outcome.checks,
            result: outcome.result,
            score: outcome.score,
            rawText: outcome.rawText ?? "",
            ocrConfidence: 0,
            assessmentNote: outcome.note,
            letterHeight: outcome.letterHeight,
            productLabel: outcome.productName,
            progress: 100,
            phase: "done",
          });
          return;

          }
          // No outcome: fall through to the in-browser pipeline below.
        }

        /* ------------------------------------------- in-browser pipeline */
        setStage("vision", "processing");
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled.current) return;
        setStage("vision", "complete");
        patch({ progress: 34 });

        let rawText: string;
        let confidence: number;

        if (state.source === "live") {
          const canvas = canvasRef.current;
          if (!canvas) throw new Error("The decoded image is no longer available. Please upload it again.");

          setStage("ocr", "processing");
          const ocr = await recogniseUpload(canvas, languages, (fraction) =>
            patch({ progress: 34 + Math.round(fraction * 26) }),
          );
          if (cancelled.current) return;

          if (ocr.rawText.trim().length === 0) {
            setStage("ocr", "failed");
            patch({
              phase: "error",
              error:
                "No text could be read from this image. Try a closer, straighter photograph of the printed declarations.",
            });
            return;
          }

          rawText = ocr.rawText;
          confidence = ocr.confidence;
        } else {
          const product = state.product;
          if (!product) return;

          setStage("ocr", "processing");
          const ocr = await api.runOcr(product.id);
          if (cancelled.current || !ocr) return;
          rawText = ocr.rawText;
          confidence = ocr.confidence;
        }

        setStage("ocr", "complete");
        patch({ rawText, ocrConfidence: confidence, progress: 62 });

        setStage("fields", "processing");
        const assessment =
          state.source === "live"
            ? assessUpload(rawText, confidence)
            : {
                fields: await api.extractFields(state.product!.id),
                ...(await api.runCompliance(state.product!.id))!,
              };
        if (cancelled.current) return;

        const shaky = assessment.fields.some((field) => field.status === "needs_review");
        setStage("fields", shaky ? "warning" : "complete");
        patch({ fields: assessment.fields, progress: 82 });

        setStage("rules", "processing");
        await new Promise((r) => setTimeout(r, 450));
        if (cancelled.current) return;
        setStage("rules", "complete");
        patch({ progress: 94 });

        setStage(
          "result",
          state.source === "live"
            ? "warning"
            : assessment.result === "compliant"
              ? "complete"
              : assessment.result === "needs_review"
                ? "warning"
                : "failed",
        );
        // A reading this thin cannot carry a verdict. The rules ran over
        // whatever the device managed to recognise, and on a live photograph
        // that is usually a few fields out of twelve — "non-compliant" would
        // then be a statement about the photograph, not about the package.
        // The finding is reported as needing review, which is what it is.
        const onDevice = state.source === "live";

        patch({
          checks: assessment.checks,
          result: onDevice ? "needs_review" : assessment.result,
          score: assessment.score,
          readOnDevice: onDevice,
          progress: 100,
          phase: "done",
        });
      } catch (error) {
        patch({
          phase: "error",
          error:
            error instanceof Error ? error.message : "The assessment could not be completed.",
        });
      }
    },
    [patch, setStage, state.product, state.source],
  );

  return { state, startDemo, startUpload, runPipeline, reset };
}
