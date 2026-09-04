/**
 * Image quality thresholds.
 *
 * Every number here is a judgement call about photographs of retail packaging,
 * not a law of nature, so they live in one file and are injectable. Tightening
 * a threshold must never require touching the analysis code.
 */
export interface QualityThresholds {
  /** Variance of the Laplacian, measured on a 0-255 luminance scale. */
  sharpness: { poor: number; marginal: number };
  /**
   * Mean luminance, 0-1. A printed label is mostly light background, so a high
   * mean is normal and is not on its own a sign of overexposure.
   */
  brightness: { poorLow: number; marginalLow: number; marginalHigh: number; poorHigh: number };
  /**
   * Share of pixels driven to pure white or pure black. This, not the mean, is
   * what actually signals lost detail: clipped pixels carry no recoverable
   * information, whatever the average brightness of the frame.
   */
  clipping: { marginal: number; poor: number };
  /** Standard deviation of luminance, 0-1. Flat images read badly even when sharp. */
  contrast: { poor: number; marginal: number };
  /** Shorter side of the image, in pixels. */
  resolution: { poor: number; marginal: number };
  /** Share of pixels sitting on a strong edge. A proxy for "is there text here at all". */
  textVisibility: { poor: number; marginal: number };
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  sharpness: { poor: 45, marginal: 120 },
  brightness: { poorLow: 0.16, marginalLow: 0.26, marginalHigh: 0.9, poorHigh: 0.96 },
  clipping: { marginal: 0.25, poor: 0.45 },
  contrast: { poor: 0.08, marginal: 0.15 },
  resolution: { poor: 360, marginal: 640 },
  textVisibility: { poor: 0.006, marginal: 0.018 },
};

/**
 * Laplacian variance scales with image size, so every image is resampled to a
 * fixed working width before measurement. Without this, the same photograph
 * would score differently purely because of its resolution.
 */
export const WORKING_WIDTH = 1000;

/** Magnitude above which a Laplacian response counts as a real edge. */
export const EDGE_MAGNITUDE = 14;
