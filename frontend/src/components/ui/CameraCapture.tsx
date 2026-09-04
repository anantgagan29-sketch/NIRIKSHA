import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera, UploadCloud } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

import { Modal } from "./Modal";
import { Button } from "./Button";
import { useCameraStream } from "@/hooks/useCameraStream";

/**
 * Taking the photograph, rather than choosing one.
 *
 * The captured frame is handed back as a File and goes into exactly the same
 * pipeline an uploaded image does — the workflow does not care how the picture
 * arrived, and there is no second, camera-shaped path through the system.
 *
 * The guide frame is not decoration. Someone photographing a packet points at
 * the front of it by instinct, and the declarations are usually on the back or
 * the side, so the frame and its instruction are what make the difference
 * between a readable capture and a retake.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  onUploadInstead,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Offered whenever the camera cannot be used, so the person is never stuck. */
  onUploadInstead?: () => void;
}) {
  const { videoRef, state, error, canSwitch, start, stop, switchCamera, capture } =
    useCameraStream();

  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const { t } = useLanguage();
  const shotRef = useRef<string | null>(null);

  // The camera runs only while this is open, and stops on every way out.
  useEffect(() => {
    if (open) {
      void start();
    } else {
      stop();
      discardShot();
    }
    // `start`/`stop` are stable callbacks from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function discardShot() {
    if (shotRef.current) URL.revokeObjectURL(shotRef.current);
    shotRef.current = null;
    setShot(null);
  }

  async function take() {
    const file = await capture();

    if (!file) return;

    // The still is held, so the camera itself is no longer needed. Stopping it
    // now means the light goes out while the person is deciding.
    stop();

    const url = URL.createObjectURL(file);
    shotRef.current = url;
    setShot({ file, url });
  }

  function retake() {
    discardShot();
    void start();
  }

  function accept() {
    if (!shot) return;
    const file = shot.file;
    discardShot();
    stop();
    onCapture(file);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("camera.title")} className="max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-console-deep">
          {/* The still replaces the preview once taken, so there is never a
              live camera and a captured frame competing for attention. */}
          {shot ? (
            <img
              src={shot.url}
              alt="The frame you captured"
              className="mx-auto max-h-[60vh] w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="mx-auto max-h-[60vh] w-full bg-console-deep object-contain"
              />

              {state === "live" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="h-[70%] w-[85%] rounded-lg border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(9,12,16,0.35)]" />
                </div>
              )}

              {state === "starting" && (
                <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/80">
                  {t("camera.starting")}
                </p>
              )}
            </>
          )}
        </div>

        {/* Errors are the hook's plain-language versions, never a browser code. */}
        {error && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-[13px] text-amber-900">{error}</p>
            {onUploadInstead && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={onUploadInstead}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {t("camera.uploadInstead")}
              </Button>
            )}
          </div>
        )}

        {!error && !shot && (
          <p className="text-center text-[13px] text-muted">
            {t("camera.instruction")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {shot ? (
            <>
              <Button variant="secondary" onClick={retake}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("camera.retake")}
              </Button>
              <Button onClick={accept}>{t("camera.usePhoto")}</Button>
            </>
          ) : (
            <>
              <Button onClick={take} disabled={state !== "live"}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                {t("camera.capture")}
              </Button>
              {canSwitch && (
                <Button variant="secondary" onClick={switchCamera} disabled={state !== "live"}>
                  <SwitchCamera className="h-4 w-4" aria-hidden="true" />
                  {t("camera.switch")}
                </Button>
              )}
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
