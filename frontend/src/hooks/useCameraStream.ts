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


/**
 * Where the on-screen guide box lands in the video's own pixels.
 *
 * With object-contain the video content is scaled to fit and centred, so an
 * element-space rectangle has to be shifted past the letterbox bars and
 * divided by the scale before it names any pixels. The result is clamped to
 * the frame: a guide that overhangs the content area crops to the content's
 * edge rather than reading pixels that do not exist.
 */
export function guideToVideoPixels(
  video: HTMLVideoElement,
  guide: Element,
): { x: number; y: number; width: number; height: number } | null {
  const element = video.getBoundingClientRect();
  const box = guide.getBoundingClientRect();

  if (!element.width || !element.height) return null;

  const scale = Math.min(element.width / video.videoWidth, element.height / video.videoHeight);
  const contentWidth = video.videoWidth * scale;
  const contentHeight = video.videoHeight * scale;
  const offsetX = element.left + (element.width - contentWidth) / 2;
  const offsetY = element.top + (element.height - contentHeight) / 2;

  const x = Math.max(0, (box.left - offsetX) / scale);
  const y = Math.max(0, (box.top - offsetY) / scale);
  const right = Math.min(video.videoWidth, (box.right - offsetX) / scale);
  const bottom = Math.min(video.videoHeight, (box.bottom - offsetY) / scale);

  const width = Math.round(right - x);
  const height = Math.round(bottom - y);

  // A degenerate box — the guide off-screen, or not laid out yet — falls
  // back to the whole frame rather than an empty capture.
  if (width < 64 || height < 64) return null;

  return { x: Math.round(x), y: Math.round(y), width, height };
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
  const capture = useCallback(async (guide?: Element | null): Promise<File | null> => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) return null;

    // What the person framed is what they get. The viewfinder dims everything
    // outside the guide box, which is a promise that only the box matters —
    // and a capture of the whole frame breaks it: the label they lined up
    // comes back small in the middle of a table, and the reading suffers for
    // it. So the capture is cropped to the guide.
    //
    // The video is shown with object-contain, so its content sits centred in
    // the element with bars on two sides. The guide's on-screen rectangle is
    // mapped through that letterboxing into the video's own pixels.
    const crop = guide ? guideToVideoPixels(video, guide) : null;

    const canvas = document.createElement("canvas");
    canvas.width = crop ? crop.width : video.videoWidth;
    canvas.height = crop ? crop.height : video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;

    if (crop) {
      context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // 0.9 is indistinguishable from 0.95 to the reader and around a third
    // smaller on the wire.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );

    if (!blob) return null;

    return new File([blob], `niriksha-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
  }, []);

  // The component going away must not leave the camera on.
  useEffect(() => stop, [stop]);

  return { videoRef, state, error, facingMode, canSwitch, start, stop, switchCamera, capture };
}
