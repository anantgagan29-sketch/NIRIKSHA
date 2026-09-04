"use client";

import type { RasterImage } from "./quality";

/**
 * Browser-side image decoding.
 *
 * Phone cameras produce images far larger than text recognition needs. Working
 * at a bounded size keeps recognition fast and memory predictable, and the
 * quality analysis is resampled internally anyway, so nothing is lost by it.
 */

export const MAX_WORKING_SIDE = 1600;

export interface DecodedImage {
  canvas: HTMLCanvasElement;
  raster: RasterImage;
  naturalWidth: number;
  naturalHeight: number;
}

export async function decodeImage(file: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      "This image could not be opened. It may be corrupted, or in a format this browser cannot read.",
    );
  });

  const { width: naturalWidth, height: naturalHeight } = bitmap;
  const scale = Math.min(1, MAX_WORKING_SIDE / Math.max(naturalWidth, naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the image for analysis.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  return {
    canvas,
    // Quality is measured on the working image, but resolution must be judged
    // on what the camera actually captured.
    raster: { width: imageData.width, height: imageData.height, data: imageData.data },
    naturalWidth,
    naturalHeight,
  };
}
