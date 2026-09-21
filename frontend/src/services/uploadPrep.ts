/**
 * Sizes a photograph for upload.
 *
 * The server reads the label from a copy no larger than 2048px on its
 * longest edge; anything above that is thrown away on arrival. A phone
 * sends 4000px and five megabytes, and on a demonstration network those
 * bytes are the slowest part of a scan. Reducing to the size the server
 * will use anyway costs nothing in what the model sees.
 *
 * The original is returned untouched when it is already within bounds, so
 * a small file is never re-encoded — re-encoding a JPEG loses a little
 * every time, and there is nothing to gain.
 */

/** Matches VISION_MAX_EDGE on the server. */
export const UPLOAD_MAX_EDGE = 2048;
const UPLOAD_JPEG_QUALITY = 0.88;
/** Below this the upload is quick regardless of pixel count. */
const SMALL_ENOUGH_BYTES = 1_200_000;

export interface PreparedUpload {
  file: File;
  /** True when the photograph was reduced before sending. */
  reduced: boolean;
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size <= SMALL_ENOUGH_BYTES) return { file, reduced: false };

  let bitmap: ImageBitmap;
  try {
    // Orientation is baked in here, so the server never sees a sideways
    // label whose EXIF tag was lost in re-encoding.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { file, reduced: false };
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, UPLOAD_MAX_EDGE / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { file, reduced: false };

    context.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
    );

    // A re-encode that did not shrink the file is not worth its quality cost.
    if (!blob || blob.size >= file.size) return { file, reduced: false };

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), reduced: true };
  } finally {
    bitmap.close();
  }
}
