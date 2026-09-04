import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns a live camera stream and, more importantly, its ending.
 *
 * A MediaStream that is not stopped keeps the camera light on and the device
 * locked against the next request, so every path out of a camera view has to
 * release it: closing, capturing, retaking, switching camera, navigating away,
 * and the component simply unmounting. Rather than repeat that in each screen
 * that wants a camera, the stream lives here and the hook's own cleanup is the
 * last line of defence.
 *
 * Errors arrive from the browser as names like "NotAllowedError", which say
 * nothing useful to a person holding a packet. They are translated once, here,
 * into something that says what to do next.
 */

export type CameraState = "idle" | "starting" | "live" | "error";

interface Options {
  /** Preferred camera. "environment" is the rear camera on a phone. */
  facing?: "environment" | "user";
}

const MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Camera access was denied. Allow camera permission in your browser, or use Upload Image instead.",
  PermissionDeniedError:
    "Camera access was denied. Allow camera permission in your browser, or use Upload Image instead.",
  NotFoundError:
    "No camera was found on this device. Use Upload Image instead.",
  DevicesNotFoundError:
    "No camera was found on this device. Use Upload Image instead.",
  NotReadableError:
    "The camera is already in use by another application. Close it and try again, or use Upload Image.",
  TrackStartError:
    "The camera could not be started. Close any other app using it, or use Upload Image.",
  OverconstrainedError:
    "This camera does not support the requested settings. Try switching camera, or use Upload Image.",
  SecurityError:
    "The camera is blocked on an insecure connection. Open NIRIKSHA over HTTPS or on localhost.",
  AbortError: "The camera stopped unexpectedly. Try again, or use Upload Image.",
};

function describe(cause: unknown): string {
  // getUserMedia is only exposed in a secure context, so its absence is
  // almost always plain HTTP rather than an old browser.
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return window.isSecureContext === false
      ? "The camera needs a secure connection. Open NIRIKSHA over HTTPS or on localhost, or use Upload Image."
      : "This browser does not support camera capture. Use Upload Image instead.";
  }

  const name = (cause as { name?: string })?.name ?? "";
  return MESSAGES[name] ?? "The camera could not be started. Use Upload Image instead.";
}

export function useCameraStream({ facing = "environment" }: Options = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(facing);
  const [canSwitch, setCanSwitch] = useState(false);

  /** Releases every track. Safe to call repeatedly and when nothing is running. */
  const stop = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;

    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState("idle");
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user" = facingMode) => {
      // Never leave a previous stream running when opening another: two live
      // streams is how a camera ends up stuck on after the view closes.
      stop();

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(describe(null));
        setState("error");
        return;
      }

      setState("starting");
      setError(null);

      try {
        // Resolution is requested, not demanded — "ideal" lets a device that
        // cannot manage 1920 give its best rather than refusing outright, and
        // the frame still has to carry small print legibly for OCR.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        setFacingMode(mode);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Autoplay is blocked in some browsers until play() is called.
          await videoRef.current.play().catch(() => undefined);
        }

        setState("live");

        // Offer a switch only where there is somewhere to switch to. Labels
        // are empty until permission is granted, which is why this runs after.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
        } catch {
          setCanSwitch(false);
        }
      } catch (cause) {
        stop();
        setError(describe(cause));
        setState("error");
      }
    },
    [facingMode, stop],
  );

  const switchCamera = useCallback(() => {
    void start(facingMode === "environment" ? "user" : "environment");
  }, [facingMode, start]);

  /**
   * Grabs the current frame as a file.
   *
   * The canvas matches the video's own resolution rather than the size it is
   * displayed at, so the capture keeps the detail the label needs — a frame
   * scaled down to the on-screen preview would lose exactly the small print
   * the inspection is looking for.
   */
  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95),
    );

    if (!blob) return null;

    return new File([blob], `niriksha-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
  }, []);

  // The component going away must not leave the camera on.
  useEffect(() => stop, [stop]);

  return { videoRef, state, error, facingMode, canSwitch, start, stop, switchCamera, capture };
}
