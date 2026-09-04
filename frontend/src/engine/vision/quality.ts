import type { ImageQuality, QualityMetric, QualityVerdict } from "@/engine/domain";
import {
  DEFAULT_THRESHOLDS,
  EDGE_MAGNITUDE,
  WORKING_WIDTH,
  type QualityThresholds,
} from "./thresholds";

/**
 * Image quality analysis.
 *
 * Pure functions over raw pixels: no canvas, no DOM, no Next. The browser
 * supplies pixels from a canvas, a test supplies a synthetic array, and a
 * future server-side path could supply a decoded buffer. All three get
 * identical numbers.
 *
 * The measurements are real. Sharpness is the variance of the Laplacian, the
 * standard focus measure: the Laplacian responds to intensity change, so a
 * sharp image with crisp glyph edges produces a wide spread of responses and a
 * blurred one produces a narrow spread clustered near zero.
 */

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, as produced by canvas getImageData. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface QualityMeasurements {
  sharpness: number;
  brightness: number;
  contrast: number;
  minSide: number;
  textVisibility: number;
  /** Share of pixels clipped to pure white or pure black, where detail is lost. */
  clipping: number;
  width: number;
  height: number;
}

/** Rec. 709 luminance, the perceptual weighting used for greyscale conversion. */
function toLuminance(image: RasterImage): Float32Array {
  const { width, height, data } = image;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }
  return out;
}

/**
 * Box-filter downscale to a fixed working width. Averaging rather than nearest
 * neighbour matters here: point sampling would alias sharp edges into noise
 * and inflate the sharpness measure on exactly the images it should penalise.
 */
function resample(
  source: Float32Array,
  width: number,
  height: number,
  targetWidth: number,
): { data: Float32Array; width: number; height: number } {
  if (width <= targetWidth) return { data: source, width, height };

  const scale = width / targetWidth;
  const targetHeight = Math.max(1, Math.round(height / scale));
  const out = new Float32Array(targetWidth * targetHeight);

  for (let y = 0; y < targetHeight; y++) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((y + 1) * scale)));
    for (let x = 0; x < targetWidth; x++) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((x + 1) * scale)));
      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          sum += source[sy * width + sx];
          count++;
        }
      }
      out[y * targetWidth + x] = sum / count;
    }
  }
  return { data: out, width: targetWidth, height: targetHeight };
}

/**
 * Variance of the 4-neighbour Laplacian, plus the share of pixels whose
 * response exceeds the edge threshold. Both come from the same convolution,
 * so they are computed in one pass.
 */
function laplacian(data: Float32Array, width: number, height: number) {
  let sum = 0;
  let sumSquares = 0;
  let edges = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const response =
        data[i - width] + data[i + width] + data[i - 1] + data[i + 1] - 4 * data[i];
      sum += response;
      sumSquares += response * response;
      if (Math.abs(response) > EDGE_MAGNITUDE) edges++;
      count++;
    }
  }

  if (count === 0) return { variance: 0, edgeRatio: 0 };
  const mean = sum / count;
  return { variance: sumSquares / count - mean * mean, edgeRatio: edges / count };
}

/**
 * Mean luminance, standard deviation, and the share of clipped pixels.
 *
 * Clipping is tracked separately from the mean because a photograph of a label
 * is mostly pale background: a high average is normal, while pixels pinned at
 * 0 or 255 are the ones that have genuinely lost their detail.
 */
function luminanceStats(data: Float32Array) {
  let sum = 0;
  let clipped = 0;
  for (const v of data) {
    sum += v;
    if (v >= 253 || v <= 2) clipped++;
  }
  const mean = sum / data.length;

  let variance = 0;
  for (const v of data) variance += (v - mean) * (v - mean);
  variance /= data.length;

  return {
    brightness: mean / 255,
    contrast: Math.sqrt(variance) / 255,
    clipping: clipped / data.length,
  };
}

/** Raw measurement, independent of any threshold or verdict. */
export function measure(image: RasterImage): QualityMeasurements {
  const grey = toLuminance(image);
  const working = resample(grey, image.width, image.height, WORKING_WIDTH);
  const { variance, edgeRatio } = laplacian(working.data, working.width, working.height);
  const { brightness, contrast, clipping } = luminanceStats(working.data);

  return {
    sharpness: variance,
    brightness,
    contrast,
    clipping,
    textVisibility: edgeRatio,
    minSide: Math.min(image.width, image.height),
    width: image.width,
    height: image.height,
  };
}

/* --------------------------------------------------------------- verdicts */

const WORST: Record<QualityVerdict, number> = { GOOD: 0, MARGINAL: 1, POOR: 2 };

/** Higher is better: score rises from 0 at the poor threshold to 1 well past marginal. */
function gradeAbove(value: number, poor: number, marginal: number) {
  const verdict: QualityVerdict = value < poor ? "POOR" : value < marginal ? "MARGINAL" : "GOOD";
  const ceiling = marginal * 2;
  const score = Math.max(0, Math.min(1, (value - poor) / (ceiling - poor)));
  return { verdict, score };
}

/** Two-sided: a value is best in the middle of the acceptable band. */
function gradeBand(
  value: number,
  poorLow: number,
  marginalLow: number,
  marginalHigh: number,
  poorHigh: number,
) {
  const verdict: QualityVerdict =
    value < poorLow || value > poorHigh
      ? "POOR"
      : value < marginalLow || value > marginalHigh
        ? "MARGINAL"
        : "GOOD";

  const centre = (marginalLow + marginalHigh) / 2;
  const halfWidth = (poorHigh - poorLow) / 2;
  const score = Math.max(0, Math.min(1, 1 - Math.abs(value - centre) / halfWidth));
  return { verdict, score };
}

/**
 * Exposure verdict.
 *
 * Judged on clipping first and the mean second. A label photographed well is
 * bright by nature; what makes it unreadable is detail pinned at pure white by
 * glare, or lost in pure black by underexposure.
 */
function gradeExposure(m: QualityMeasurements, thresholds: QualityThresholds) {
  const { poorLow, marginalLow, marginalHigh, poorHigh } = thresholds.brightness;
  const meanGrade = gradeBand(m.brightness, poorLow, marginalLow, marginalHigh, poorHigh);

  const clipGrade: QualityVerdict =
    m.clipping > thresholds.clipping.poor
      ? "POOR"
      : m.clipping > thresholds.clipping.marginal
        ? "MARGINAL"
        : "GOOD";

  const verdict = WORST[clipGrade] > WORST[meanGrade.verdict] ? clipGrade : meanGrade.verdict;

  const detail =
    clipGrade !== "GOOD"
      ? `${pct(m.clipping)} of the frame is clipped to pure white or black, where no detail survives. This usually means glare on the print or deep shadow across it.`
      : m.brightness < marginalLow
        ? `Mean luminance ${pct(m.brightness)}. The image is underexposed; dark areas lose character strokes.`
        : m.brightness > marginalHigh
          ? `Mean luminance ${pct(m.brightness)}. The image is very bright, close to the point where print stops separating from the background.`
          : `Mean luminance ${pct(m.brightness)} with ${pct(m.clipping)} of the frame clipped — within the readable range.`;

  return { verdict, score: meanGrade.score * (clipGrade === "GOOD" ? 1 : 0.5), detail };
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export interface QualityAssessment extends Omit<ImageQuality, "scanId"> {
  measurements: QualityMeasurements;
}

/**
 * Turns measurements into per-metric verdicts, an overall verdict, a score and
 * the plain-language reasons behind them.
 *
 * The gate is deliberate: a POOR overall verdict stops the pipeline. Running
 * OCR on an unreadable frame produces a confident-looking result from nothing,
 * which is worse than asking for another photograph.
 */
export function assessQuality(
  image: RasterImage,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
): QualityAssessment {
  return grade(measure(image), thresholds);
}

/**
 * Grades raw measurements against thresholds.
 *
 * Split from `measure` on purpose: the browser has the pixels and reports the
 * measurements, but the *verdict* is the server's to make, against its own
 * thresholds. A client cannot declare its own image acceptable.
 */
export function grade(
  m: QualityMeasurements,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
): QualityAssessment {
  const sharpness = gradeAbove(m.sharpness, thresholds.sharpness.poor, thresholds.sharpness.marginal);
  const brightness = gradeExposure(m, thresholds);
  const contrast = gradeAbove(m.contrast, thresholds.contrast.poor, thresholds.contrast.marginal);
  const resolution = gradeAbove(m.minSide, thresholds.resolution.poor, thresholds.resolution.marginal);
  const textVisibility = gradeAbove(
    m.textVisibility,
    thresholds.textVisibility.poor,
    thresholds.textVisibility.marginal,
  );

  const metrics: QualityMetric[] = [
    {
      key: "sharpness",
      label: "Sharpness",
      value: Math.round(m.sharpness * 10) / 10,
      score: sharpness.score,
      verdict: sharpness.verdict,
      detail:
        sharpness.verdict === "POOR"
          ? `Laplacian variance ${m.sharpness.toFixed(0)} is below ${thresholds.sharpness.poor}. The image is too blurred for the small print on a label to be read reliably.`
          : sharpness.verdict === "MARGINAL"
            ? `Laplacian variance ${m.sharpness.toFixed(0)}. Edges are soft; fine print may be misread.`
            : `Laplacian variance ${m.sharpness.toFixed(0)}. Edges are crisp.`,
    },
    {
      key: "brightness",
      label: "Brightness",
      value: Math.round(m.brightness * 1000) / 1000,
      score: brightness.score,
      verdict: brightness.verdict,
      detail: brightness.detail,
    },
    {
      key: "contrast",
      label: "Contrast",
      value: Math.round(m.contrast * 1000) / 1000,
      score: contrast.score,
      verdict: contrast.verdict,
      detail:
        contrast.verdict === "GOOD"
          ? `Luminance spread ${pct(m.contrast)}. Text separates clearly from the background.`
          : `Luminance spread ${pct(m.contrast)}. Low separation between text and background.`,
    },
    {
      key: "resolution",
      label: "Resolution",
      value: m.minSide,
      score: resolution.score,
      verdict: resolution.verdict,
      detail: `${m.width}x${m.height} pixels, shorter side ${m.minSide}px${
        resolution.verdict === "GOOD"
          ? ". Enough detail for small declarations."
          : `. Below the ${thresholds.resolution.marginal}px shorter side needed for small print.`
      }`,
    },
    {
      key: "textVisibility",
      label: "Text visibility",
      value: Math.round(m.textVisibility * 10000) / 10000,
      score: textVisibility.score,
      verdict: textVisibility.verdict,
      detail:
        textVisibility.verdict === "POOR"
          ? `Only ${pct(m.textVisibility)} of the frame sits on a strong edge. Very little text-like structure was found — the label may be out of frame.`
          : `${pct(m.textVisibility)} of the frame sits on a strong edge, consistent with printed text.`,
    },
  ];

  const verdict = metrics.reduce<QualityVerdict>(
    (worst, metric) => (WORST[metric.verdict] > WORST[worst] ? metric.verdict : worst),
    "GOOD",
  );

  const reasons = metrics
    .filter((metric) => metric.verdict !== "GOOD")
    .map((metric) => metric.detail);

  const score = Math.round(
    (metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length) * 100,
  );

  return {
    metrics,
    verdict,
    score,
    reasons,
    proceedToOcr: verdict !== "POOR",
    widthPx: m.width,
    heightPx: m.height,
    analysedAt: new Date().toISOString(),
    measurements: m,
  };
}

export { DEFAULT_THRESHOLDS, type QualityThresholds } from "./thresholds";
