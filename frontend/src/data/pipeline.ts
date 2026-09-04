import type { PipelineStage } from "./types";

/** The six stages shown in the inspection workspace. */
export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "quality",
    index: "01",
    title: "Image Quality",
    description: "Sharpness, brightness, resolution and text visibility measured before anything is read.",
  },
  {
    id: "vision",
    index: "02",
    title: "Computer Vision",
    description: "The label surface is located and the regions carrying declarations are isolated.",
  },
  {
    id: "ocr",
    index: "03",
    title: "OCR Extraction",
    description: "Text recognised with a confidence value for every word. Raw output is preserved.",
  },
  {
    id: "fields",
    index: "04",
    title: "Field Extraction",
    description: "Free text becomes structured declarations, each keeping the evidence it came from.",
  },
  {
    id: "rules",
    index: "05",
    title: "Rule Validation",
    description: "Only the requirements that apply to this package are selected and tested.",
  },
  {
    id: "result",
    index: "06",
    title: "Compliance Result",
    description: "Field outcomes combined into an assessment, with the reason for each.",
  },
];

/** How the landing and How-it-works pages describe the same journey. */
export const JOURNEY = [
  { index: "01", title: "Capture", body: "Photograph or upload the face of the package carrying the declarations." },
  { index: "02", title: "Computer Vision", body: "The frame is measured for readability, and the label region located." },
  { index: "03", title: "OCR & Extraction", body: "Text is recognised with confidence, then resolved into named declarations." },
  { index: "04", title: "Rule Engine", body: "Applicable requirements are selected — conditional ones are not applied blindly." },
  { index: "05", title: "Compliance & Report", body: "An explained result, a downloadable assessment, and a route to raise a complaint." },
];
