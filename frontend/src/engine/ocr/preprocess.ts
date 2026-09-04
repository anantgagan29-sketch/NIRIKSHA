/**
 * Prepares a photograph for Tesseract.
 *
 * Tesseract was built for scanned documents: even lighting, dark text, a
 * white page, and text large enough to have real strokes. A phone photograph
 * of a packet is none of those. Handing it the raw frame is what produced
 * readings in the thirties on an underexposed label — the engine was not
 * failing, it was being given something it could not work with.
 *
 * Three corrections, in the order that matters:
 *
 *   1. **Grey.** Colour carries no information for character shapes, and the
 *      green-on-green printing common on Indian packaging separates far
 *      better by luminance than by hue.
 *
 *   2. **Stretch.** A dark photo uses a narrow band of the available range.
 *      Mapping the band the image actually occupies onto the full range is
 *      what turns faint strokes into strokes. Percentiles rather than the
 *      extremes, so one glare spot or one dark corner cannot define the range
 *      for the whole label.
 *
 *   3. **Enlarge.** Small text has too few pixels per stroke to resolve.
 *      Upscaling adds no detail, but it gives the classifier strokes it can
 *      measure, which in practice it reads considerably better.
 *
 * Nothing here invents content. It changes how the same pixels are presented,
 * and the confidence Tesseract reports afterwards is still its own honest
 * assessment of what it read.
 */

/** Shorter side to aim for. Below this, small print has too few pixels. */
const TARGET_SHORT_EDGE = 1400;

/** A ceiling, so a large photo is not enlarged into a slow, pointless one. */
const MAX_PIXELS = 4_000_000;

/** Ignored at each end when deciding the range the image occupies. */
const CLIP_PERCENTILE = 0.02;

export interface PreprocessResult {
  canvas: HTMLCanvasElement;
  /** What was done, for the console when a reading looks wrong. */
  notes: string[];
}

export function prepareForOcr(source: HTMLCanvasElement): PreprocessResult {
  const notes: string[] = [];

  const shortEdge = Math.min(source.width, source.height);

  // Enlarge only when the text is likely to be too small to resolve, and
  // never past the pixel ceiling.
  let scale = shortEdge < TARGET_SHORT_EDGE ? TARGET_SHORT_EDGE / shortEdge : 1;

  if (source.width * source.height * scale * scale > MAX_PIXELS) {
    scale = Math.sqrt(MAX_PIXELS / (source.width * source.height));
  }

  scale = Math.max(1, scale);

  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    // Without a context there is nothing to correct; the original still reads,
    // just less well.
    return { canvas: source, notes: ["no 2d context; used the image as-is"] };
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  if (scale > 1) notes.push(`enlarged ${scale.toFixed(2)}x to ${width}x${height}`);

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;

  // ---- grey, and a histogram of what the image actually uses ----

  const histogram = new Uint32Array(256);
  const grey = new Uint8ClampedArray(width * height);

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    // Rec. 601 luma: the weights match how the eye reads contrast, which is
    // what "legible" means here.
    const value = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
    const rounded = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
    grey[p] = rounded;
    histogram[rounded] += 1;
  }

  // ---- the range the image occupies, ignoring the extremes ----

  const total = width * height;
  const cut = Math.floor(total * CLIP_PERCENTILE);

  let low = 0;
  let high = 255;

  for (let seen = 0, level = 0; level < 256; level += 1) {
    seen += histogram[level];
    if (seen > cut) {
      low = level;
      break;
    }
  }

  for (let seen = 0, level = 255; level >= 0; level -= 1) {
    seen += histogram[level];
    if (seen > cut) {
      high = level;
      break;
    }
  }

  // A range too narrow to stretch means a flat image — stretching it would
  // amplify sensor noise into something that looks like text.
  const span = high - low;

  if (span > 8) {
    const factor = 255 / span;

    for (let p = 0, i = 0; p < grey.length; p += 1, i += 4) {
      const stretched = (grey[p] - low) * factor;
      const value = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }

    notes.push(`levels ${low}-${high} stretched to 0-255`);
  } else {
    for (let p = 0, i = 0; p < grey.length; p += 1, i += 4) {
      pixels[i] = grey[p];
      pixels[i + 1] = grey[p];
      pixels[i + 2] = grey[p];
      pixels[i + 3] = 255;
    }

    notes.push(`levels ${low}-${high} too narrow to stretch; greyscale only`);
  }

  context.putImageData(image, 0, 0);

  return { canvas, notes };
}
