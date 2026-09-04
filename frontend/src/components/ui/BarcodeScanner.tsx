import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, RefreshCw, ScanBarcode, SwitchCamera, UploadCloud } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { Field, Input } from "./Form";
import { useCameraStream } from "@/hooks/useCameraStream";
import { guessFormat, validateBarcode, type BarcodeFormat } from "@/lib/barcode";
import { lookupBarcode, type BarcodeLookup } from "@/services/nirikshaApi";

/**
 * Reading a barcode off the pack, continuously, on the device.
 *
 * Frames are decoded here rather than sent anywhere: a scanner that had to
 * round-trip every frame would be too slow to hold a packet steady for, and
 * would spend network and API budget on frames containing nothing at all.
 *
 * A detected code is checked before it is believed. A camera reading at an
 * angle can produce digits that are not the code on the pack, and the check
 * digit these symbologies carry exists exactly to catch that — so a failed
 * check keeps scanning instead of reporting a number that was misread.
 *
 * What the barcode is *not* is a compliance verdict. It may identify the
 * product; whether the pack carries its required declarations is decided by
 * the image inspection that follows, and by nothing else.
 */

/**
 * ZXing reports the symbology as its enum's numeric value, not its name, so
 * the codes are mapped rather than the names. Getting this wrong is quiet
 * rather than loud: the label simply goes missing, and an alphanumeric code
 * then gets judged against the numeric rules and rejected.
 */
const FORMAT_LABEL: Record<number, BarcodeFormat> = {
  2: "Code 39",
  4: "Code 128",
  6: "EAN-8",
  7: "EAN-13",
  8: "ITF",
  11: "QR Code",
  14: "UPC-A",
  15: "UPC-E",
};

interface Detected {
  value: string;
  format: BarcodeFormat | null;
  lookup: BarcodeLookup | null;
  lookupFailed: boolean;
}

export function BarcodeScanner({
  open,
  onClose,
  onContinue,
  onUploadInstead,
}: {
  open: boolean;
  onClose: () => void;
  /** The scan is finished; the inspection carries on with the pack itself. */
  onContinue: (barcode: string, format: BarcodeFormat | null) => void;
  onUploadInstead?: () => void;
}) {
  const { videoRef, state, error, canSwitch, start, stop, switchCamera } = useCameraStream();

  const [detected, setDetected] = useState<Detected | null>(null);
  const { t } = useLanguage();
  const [hint, setHint] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  // The decoder holds a callback loop of its own; it has to be torn down
  // explicitly or it keeps decoding into a closed screen.
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const settledRef = useRef(false);

  const stopDecoding = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  /** A code has been read and believed: stop everything and report it. */
  const settle = useCallback(
    async (value: string, format: BarcodeFormat | null) => {
      if (settledRef.current) return;
      settledRef.current = true;

      stopDecoding();
      stop();

      // Identification is optional. If there is no lookup source, or it is
      // unreachable, the inspection still goes ahead — the barcode was read,
      // and that is what this screen was for.
      let lookup: BarcodeLookup | null = null;
      let lookupFailed = false;

      try {
        lookup = await lookupBarcode(value);
      } catch {
        lookupFailed = true;
      }

      setDetected({ value, format, lookup, lookupFailed });
    },
    [stop, stopDecoding],
  );

  const beginDecoding = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");

    // Restricting the formats is what keeps decoding quick: the reader stops
    // trying symbologies that never appear on retail packaging.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    controlsRef.current = await reader.decodeFromVideoElement(video, (result) => {
      if (!result || settledRef.current) return;

      const value = result.getText().trim();
      const reported = result.getBarcodeFormat?.();
      const format =
        (typeof reported === "number" ? FORMAT_LABEL[reported] : undefined) ?? guessFormat(value);

      const check = validateBarcode(value, format ?? undefined);

      if (!check.valid) {
        // Keep scanning rather than reporting a misread. The frame will come
        // round again a moment later.
        setHint(check.reason ?? "That code could not be read cleanly. Hold steady and try again.");
        return;
      }

      setHint(null);
      void settle(value, format);
    });
  }, [settle, videoRef]);

  const restart = useCallback(async () => {
    settledRef.current = false;
    setDetected(null);
    setHint(null);
    await start();
  }, [start]);

  useEffect(() => {
    if (!open) {
      stopDecoding();
      stop();
      settledRef.current = false;
      setDetected(null);
      setHint(null);
      setManual(false);
      setTyped("");
      setTypedError(null);
      return;
    }

    settledRef.current = false;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Decoding can only attach once there is a running video to read from.
  useEffect(() => {
    if (state === "live" && !detected && !controlsRef.current) void beginDecoding();
  }, [state, detected, beginDecoding]);

  // Whatever unmounts this must not leave a decoder running.
  useEffect(() => stopDecoding, [stopDecoding]);

  function submitTyped() {
    const value = typed.trim();
    const format = guessFormat(value);
    const check = validateBarcode(value, format ?? undefined);

    if (!check.valid) {
      setTypedError(check.reason ?? "That barcode is not valid.");
      return;
    }

    setTypedError(null);
    void settle(value, format);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("barcode.title")} className="max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        {detected ? (
          <DetectedPanel detected={detected} />
        ) : manual ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              {t("barcode.manualHint")}
            </p>
            <Field label={t("barcode.manualLabel")} htmlFor="manual-barcode">
            <Input
              id="manual-barcode"
              value={typed}
              inputMode="numeric"
              placeholder="8901058000191"
              onChange={(event) => {
                setTyped(event.target.value);
                setTypedError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitTyped();
              }}
            />
            </Field>
            {typedError && <p className="text-[12.5px] text-red-700">{typedError}</p>}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-console-deep">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="mx-auto max-h-[60vh] w-full bg-console-deep object-contain"
            />

            {state === "live" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative h-[38%] w-[85%] rounded-lg border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(9,12,16,0.35)]">
                  {/* A moving line, so it is obvious the scanner is working
                      even before anything has been read. */}
                  <span className="nk-scanline absolute inset-x-2 h-0.5 rounded bg-brand-400/90" />
                </div>
              </div>
            )}

            {state === "starting" && (
              <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/80">
                Starting the camera…
              </p>
            )}
          </div>
        )}

        {error && !detected && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-[13px] text-amber-900">{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setManual(true)}>
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                {t("barcode.manualShort")}
              </Button>
              {onUploadInstead && (
                <Button size="sm" variant="secondary" onClick={onUploadInstead}>
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  {t("camera.uploadInstead")}
                </Button>
              )}
            </div>
          </div>
        )}

        {!detected && !manual && !error && (
          <p className="text-center text-[13px] text-muted">
            {hint ?? t("barcode.instruction")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {detected ? (
            <>
              <Button onClick={() => onContinue(detected.value, detected.format)}>
                {t("barcode.continueInspection")}
              </Button>
              <Button variant="secondary" onClick={restart}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("barcode.scanAgain")}
              </Button>
            </>
          ) : manual ? (
            <>
              <Button onClick={submitTyped}>{t("barcode.useThis")}</Button>
              <Button variant="secondary" onClick={() => setManual(false)}>
                <ScanBarcode className="h-4 w-4" aria-hidden="true" />
                {t("barcode.backToScanning")}
              </Button>
            </>
          ) : (
            <>
              {canSwitch && (
                <Button variant="secondary" onClick={switchCamera} disabled={state !== "live"}>
                  <SwitchCamera className="h-4 w-4" aria-hidden="true" />
                  {t("camera.switch")}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setManual(true)}>
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                {t("barcode.manual")}
              </Button>
              <Button variant="subtle" onClick={onClose}>
                {t("common.close")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** What was read, and what is — and is not — known about it. */
function DetectedPanel({ detected }: { detected: Detected }) {
  const { t } = useLanguage();
  const { value, format, lookup, lookupFailed } = detected;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 px-5 py-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-brand-700">
          {t("barcode.detected")}
        </p>
        {format && <p className="mt-1 text-[13px] text-muted">{format}</p>}
        <p className="mt-1 font-mono text-[20px] font-semibold tracking-wide text-ink">{value}</p>
      </div>

      {lookupFailed ? (
        <p className="rounded-md border border-line bg-canvas px-4 py-3 text-[13px] text-muted">
          {t("barcode.lookupUnavailable")}
        </p>
      ) : lookup?.found ? (
        <div className="rounded-md border border-line bg-canvas px-4 py-3">
          <p className="text-[13px] font-medium text-ink">{lookup.product_name}</p>
          {lookup.source && <p className="mt-0.5 text-[12px] text-muted">Source: {lookup.source}</p>}
        </div>
      ) : (
        <p className="rounded-md border border-line bg-canvas px-4 py-3 text-[13px] text-muted">
          {lookup?.message ?? "No product record is held for this barcode."}
          {lookup?.issuing_region ? ` The prefix is registered in ${lookup.issuing_region}.` : ""}
        </p>
      )}

      {/* Said plainly, because a detected barcode looks like a result and is
          not one. */}
      <p className="rounded-md border border-line bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-muted">
        A barcode identifies a product; it says nothing about whether the pack carries its required
        declarations. Compliance is assessed from the packaging itself in the next step.
      </p>
    </div>
  );
}
