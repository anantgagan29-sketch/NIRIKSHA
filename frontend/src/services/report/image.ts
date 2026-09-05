import { reportFilename, saveBlob, type ReportData } from "./model";

/**
 * The assessment as a single tall image.
 *
 * Drawn onto a canvas from the same report data rather than photographed off
 * the screen. A screenshot captures the viewport, so a long assessment loses
 * everything below the fold — the requirements, usually, which is the part
 * worth sending to someone. Here the height is measured from the content
 * first and the canvas is made to fit it, so the picture cannot be cut off no
 * matter how many requirements a scan produced.
 *
 * Everything is laid out at 2x and drawn through a scaled context, so the
 * result is sharp on a phone screen and legible when someone zooms in.
 */

const SCALE = 2;
const WIDTH = 800;
const MARGIN = 48;
const CONTENT = WIDTH - MARGIN * 2;

const INK = "#16202a";
const MUTED = "#6b7784";
const HAIRLINE = "#dfe3e7";
const PAPER = "#ffffff";

const STATUS_COLOUR: Record<string, string> = {
  pass: "#22994a",
  fail: "#c92a2a",
  review: "#b87908",
  not_applicable: MUTED,
};

const STATUS_MARK: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  review: "⚠",
  not_applicable: "—",
};

const FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function font(size: number, weight: 400 | 600 | 700 = 400): string {
  return `${weight} ${size}px ${FAMILY}`;
}

/**
 * A drawing pass that can also run without drawing.
 *
 * The canvas has to be the right height before anything is painted on it, and
 * the height is not known until the text has been wrapped. Rather than
 * maintaining a separate measuring routine that would drift from the drawing
 * one, the same code runs twice: once to measure, once to paint.
 */
class Sheet {
  private context: CanvasRenderingContext2D;
  private measuring: boolean;
  y = MARGIN;

  constructor(context: CanvasRenderingContext2D, measuring: boolean) {
    this.context = context;
    this.measuring = measuring;
  }

  private lines(text: string, width: number): string[] {
    const out: string[] = [];
    let line = "";

    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;

      if (this.context.measureText(candidate).width > width && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) out.push(line);
    return out.length ? out : [""];
  }

  text(
    content: string,
    options: { size?: number; weight?: 400 | 600 | 700; colour?: string; indent?: number } = {},
  ) {
    const size = options.size ?? 14;
    const indent = options.indent ?? 0;

    this.context.font = font(size, options.weight ?? 400);
    this.context.fillStyle = options.colour ?? INK;

    for (const line of this.lines(content, CONTENT - indent)) {
      this.y += size + 6;
      if (!this.measuring) this.context.fillText(line, MARGIN + indent, this.y);
    }
  }

  heading(content: string) {
    this.move(14);
    this.rule();
    this.move(6);
    this.text(content, { size: 17, weight: 700 });
    this.move(4);
  }

  /** The photograph, bounded on both edges so its proportions are untouched. */
  image(bitmap: ImageBitmap, maxWidth: number, maxHeight: number) {
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;

    this.y += 8;
    if (!this.measuring) this.context.drawImage(bitmap, MARGIN, this.y, width, height);
    this.y += height + 8;
  }

  rule() {
    this.y += 6;

    if (!this.measuring) {
      this.context.strokeStyle = HAIRLINE;
      this.context.lineWidth = 1;
      this.context.beginPath();
      this.context.moveTo(MARGIN, this.y);
      this.context.lineTo(WIDTH - MARGIN, this.y);
      this.context.stroke();
    }

    this.y += 6;
  }

  move(by: number) {
    this.y += by;
  }
}

/** Lays the whole report out. Called once to measure, once to draw. */
function compose(sheet: Sheet, data: ReportData, bitmap: ImageBitmap | null): void {
  sheet.text("NIRIKSHA", { size: 30, weight: 700 });
  sheet.text("COMPLIANCE ASSESSMENT", { size: 12, weight: 600, colour: MUTED });
  sheet.move(8);
  sheet.rule();

  sheet.text(`Scan reference: ${data.scanReference}`, { size: 13 });
  sheet.text(`Assessed: ${data.assessedLabel}`, { size: 13, colour: MUTED });

  sheet.heading("Assessment");
  sheet.text(`${data.resultLabel.toUpperCase()} — SCORE ${data.score}`, {
    size: 18,
    weight: 700,
    colour:
      data.result === "compliant"
        ? STATUS_COLOUR.pass
        : data.result === "non_compliant"
          ? STATUS_COLOUR.fail
          : STATUS_COLOUR.review,
  });
  sheet.move(4);
  sheet.text(`Product: ${data.productName}`, { size: 14 });
  sheet.text(`Net quantity: ${data.netQuantity}`, { size: 14 });

  if (data.qualification) {
    sheet.move(6);
    sheet.text(data.qualification, { size: 12, colour: STATUS_COLOUR.review });
  }

  sheet.heading("Product image");

  if (bitmap) {
    sheet.image(bitmap, 300, 300);
  } else {
    sheet.text(data.imageNote ?? "Product image unavailable.", { size: 13, colour: MUTED });
  }

  sheet.heading("Declarations read from the label");

  for (const field of data.fields) {
    sheet.text(`${field.label}: ${field.value}`, { size: 13.5 });

    if (field.confidence !== null) {
      sheet.text(`read at ${field.confidence}% confidence`, {
        size: 11.5,
        colour: MUTED,
        indent: 14,
      });
    }

    sheet.move(2);
  }

  sheet.heading("Requirements assessed");

  for (const requirement of data.requirements) {
    sheet.move(6);
    sheet.text(
      `${STATUS_MARK[requirement.status] ?? ""} ${requirement.label} — ${requirement.statusLabel}`,
      { size: 14, weight: 600, colour: STATUS_COLOUR[requirement.status] ?? MUTED },
    );

    if (requirement.requirement) {
      sheet.text(`Requirement: ${requirement.requirement}`, { size: 12.5, indent: 14 });
    }
    if (requirement.finding) {
      sheet.text(`Finding: ${requirement.finding}`, { size: 12.5, indent: 14 });
    }
    if (requirement.detected) {
      sheet.text(`Detected: ${requirement.detected}`, { size: 12.5, indent: 14 });
    }
    if (requirement.legalReference) {
      sheet.text(requirement.legalReference, { size: 11.5, colour: MUTED, indent: 14 });
    }
  }

  sheet.heading("Scope of this assessment");
  sheet.text(data.scope, { size: 12.5, colour: MUTED });
  sheet.move(MARGIN);
}

export type ReportImageFormat = "png" | "jpeg";

export async function buildImageReport(
  data: ReportData,
  format: ReportImageFormat = "png",
): Promise<Blob> {
  const bitmap = data.image
    ? await createImageBitmap(new Blob([data.image.bytes as BufferSource], { type: data.image.mime }))
    : null;

  // Pass one: measure. A 1x1 canvas is enough — nothing is painted, and the
  // text metrics do not depend on the surface's size.
  const ruler = document.createElement("canvas").getContext("2d");
  if (!ruler) throw new Error("This browser did not provide a canvas to draw the report on.");

  const measure = new Sheet(ruler, true);
  compose(measure, data, bitmap);

  // Pass two: draw, onto a canvas made to fit what pass one measured.
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(measure.y) * SCALE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser did not provide a canvas to draw the report on.");

  context.scale(SCALE, SCALE);

  // JPEG has no transparency: without this the background comes out black.
  context.fillStyle = PAPER;
  context.fillRect(0, 0, WIDTH, canvas.height);
  context.textBaseline = "alphabetic";

  compose(new Sheet(context, false), data, bitmap);
  bitmap?.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, `image/${format}`, format === "jpeg" ? 0.92 : undefined),
  );

  if (!blob) throw new Error("The report image could not be encoded.");
  return blob;
}

export async function downloadImageReport(
  data: ReportData,
  format: ReportImageFormat = "png",
): Promise<void> {
  saveBlob(
    await buildImageReport(data, format),
    reportFilename(data, format === "jpeg" ? "jpg" : "png"),
  );
}
