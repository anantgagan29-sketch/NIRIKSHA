import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { reportFilename, saveBlob, type ReportData } from "@/services/report/model";
// The dark lockup: these pages are white, and the light variant exists for
// the console's dark surface.
// `?inline` gives a data: URI rather than a path. A plain asset import hands
// back a URL that the dev server answers with a JavaScript module wrapping
// the path — fetching it returned 389 bytes of script, embedPng rejected it,
// and the report quietly fell back to the text masthead. A data: URI carries
// the bytes themselves, so the logo does not depend on a server answering
// correctly, and behaves the same in development and in the built app.
import logoUrl from "@/assets/niriksha-logo.png?inline";

/**
 * The compliance report, as a real PDF file.
 *
 * The report has to stand on its own. Someone reading it without the app must
 * be able to see what was assessed, what was found, why each conclusion was
 * reached, and — just as importantly — what the assessment is not. The legal
 * qualification is drawn on every page for that reason, not tucked into a
 * footnote on the last one.
 *
 * It is built in the browser rather than on the server: the assessment is
 * already on this device, so generating the document here costs nothing, works
 * with the backend unavailable, and never queues behind a vision model.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.09, 0.12, 0.16);
const MUTED = rgb(0.42, 0.47, 0.53);
const HAIRLINE = rgb(0.85, 0.87, 0.89);

const STATUS_COLOUR: Record<string, ReturnType<typeof rgb>> = {
  pass: rgb(0.13, 0.6, 0.29),
  fail: rgb(0.79, 0.16, 0.16),
  review: rgb(0.72, 0.47, 0.05),
  not_applicable: rgb(0.42, 0.47, 0.53),
};

const NOTICE =
  "This is an automated, AI-assisted preliminary assessment produced from a photograph. " +
  "It is a decision-support tool, not a statutory inspection, and it is not a government " +
  "certification. Findings require confirmation by a person before any action is taken.";

/**
 * The standard PDF fonts encode WinAnsi only, which has no rupee sign — and a
 * price is exactly where one appears. Rather than letting the document fail to
 * generate, unsupported characters are replaced and the count is reported, so
 * the report can say plainly that some characters could not be drawn.
 */
function encodable(code: number): boolean {
  return code >= 32 && code <= 126 ? true : code >= 160 && code <= 255;
}

function pdfSafe(text: string): { text: string; dropped: number } {
  let dropped = 0;
  let out = "";

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;

    if (encodable(code)) {
      out += character;
    } else if (character === "₹") {
      out += "Rs.";
    } else if (character === "—" || character === "–") {
      out += "-";
    } else if (character === "’" || character === "‘") {
      out += "'";
    } else if (character === "“" || character === "”") {
      out += '"';
    } else {
      out += "?";
      dropped += 1;
    }
  }

  return { text: out, dropped };
}

/** Lays text down the page, starting a new one when it runs out of room. */
class Writer {
  private page: PDFPage;
  private y: number;
  readonly width = A4[0] - MARGIN * 2;
  droppedCharacters = 0;

  // Fields are declared and assigned explicitly rather than through
  // constructor parameter properties, which this build's TypeScript settings
  // do not allow.
  private doc: PDFDocument;
  private regular: PDFFont;
  private bold: PDFFont;

  private constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.page = this.newPage();
    this.y = A4[1] - MARGIN;
  }

  static async create(doc: PDFDocument) {
    return new Writer(
      doc,
      await doc.embedFont(StandardFonts.Helvetica),
      await doc.embedFont(StandardFonts.HelveticaBold),
    );
  }

  private newPage(): PDFPage {
    const page = this.doc.addPage(A4);

    // The qualification appears on every page, because a page read on its own
    // must still carry it.
    page.drawText(pdfSafe(NOTICE.slice(0, 118)).text, {
      x: MARGIN,
      y: 26,
      size: 6.5,
      font: this.regular ?? undefined,
      color: MUTED,
      maxWidth: this.width,
    });

    return page;
  }

  private space(needed: number) {
    if (this.y - needed < MARGIN + 40) {
      this.page = this.newPage();
      this.y = A4[1] - MARGIN;
    }
  }

  private wrap(text: string, size: number, width: number, font: PDFFont): string[] {
    const lines: string[] = [];
    let line = "";

    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  text(
    content: string,
    options: { size?: number; bold?: boolean; colour?: ReturnType<typeof rgb>; indent?: number } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.regular;
    const indent = options.indent ?? 0;

    const safe = pdfSafe(content);
    this.droppedCharacters += safe.dropped;

    for (const line of this.wrap(safe.text, size, this.width - indent, font)) {
      this.space(size + 4);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - size,
        size,
        font,
        color: options.colour ?? INK,
      });
      this.y -= size + 4;
    }
  }

  /**
   * Draws an image at the current position, scaled to `width`.
   *
   * The height follows from the artwork's own proportions — a logo squashed
   * to fit a box is worse than no logo.
   */
  image(png: PDFImage, width: number, maxHeight?: number) {
    let drawWidth = width;
    let height = (png.height / png.width) * drawWidth;

    // A portrait photograph constrained only by width runs the length of the
    // page. Both edges are bounded, and the smaller scale wins, so the
    // proportions are never touched.
    if (maxHeight && height > maxHeight) {
      drawWidth = (png.width / png.height) * maxHeight;
      height = maxHeight;
    }

    this.space(height + 6);
    this.page.drawImage(png, {
      x: MARGIN,
      y: this.y - height,
      width: drawWidth,
      height,
    });
    this.y -= height + 6;
  }

  move(by: number) {
    this.space(by);
    this.y -= by;
  }

  rule() {
    this.space(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4[0] - MARGIN, y: this.y },
      thickness: 0.6,
      color: HAIRLINE,
    });
    this.y -= 8;
  }
}

/**
 * Reads the logo artwork for embedding.
 *
 * Returns null rather than throwing: a report without its logo is still a
 * usable report, and refusing to produce one because an image failed to load
 * would be the wrong trade.
 */
async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  // A report without its logo is still a usable report, so this never throws.
  // It does say why it gave up, though: the last time the artwork failed to
  // load, the silent fallback meant nobody noticed until the printed document
  // turned up plain.
  try {
    const response = await fetch(logoUrl);

    if (!response.ok) {
      console.warn(`Report logo: fetch returned ${response.status}; using the text masthead.`);
      return null;
    }

    return await doc.embedPng(await response.arrayBuffer());
  } catch (cause) {
    console.warn("Report logo: could not be embedded; using the text masthead.", cause);
    return null;
  }
}


export async function buildComplianceReport(data: ReportData): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setTitle(`NIRIKSHA compliance assessment ${data.scanReference}`);
  doc.setProducer("NIRIKSHA");
  doc.setCreationDate(new Date());

  const w = await Writer.create(doc);

  /* masthead */
  // The lockup already carries the wordmark and the line beneath it, so
  // neither is repeated as text when the artwork loads. If it cannot be
  // fetched the report still has to be produced, so the text masthead stands
  // in rather than the document failing over a picture.
  const logo = await loadLogo(doc);

  if (logo) {
    w.image(logo, 150);
  } else {
    w.text("NIRIKSHA", { size: 20, bold: true });
    w.text("Automated compliance assessment for packaged commodities", {
      size: 9,
      colour: MUTED,
    });
  }

  w.move(6);
  w.rule();

  w.text(`Scan reference: ${data.scanReference}`, { size: 9 });
  w.text(`Assessed: ${data.assessedLabel}`, { size: 9, colour: MUTED });
  w.move(10);

  /* outcome */
  w.text("Assessment", { size: 13, bold: true });
  w.move(2);
  w.text(`${data.resultLabel} — score ${data.score}`, {
    size: 11,
    bold: true,
    colour:
      STATUS_COLOUR[
        data.result === "compliant" ? "pass" : data.result === "non_compliant" ? "fail" : "review"
      ],
  });
  w.text(`Product: ${data.productName}`, { size: 10 });
  w.text(`Net quantity: ${data.netQuantity}`, { size: 10 });

  if (data.qualification) {
    w.move(4);
    w.text(data.qualification, { size: 8.5, colour: STATUS_COLOUR.review });
  }

  w.move(10);

  /* the photograph this assessment was made from */
  // Placed before the readings, because everything below is a claim about
  // this picture and a reader should see it first. Bounded on both edges so
  // it illustrates the report rather than filling its opening page.
  w.text("Product image", { size: 10, bold: true });
  w.move(4);

  if (data.image) {
    try {
      w.image(await doc.embedPng(data.image.bytes), 200, 200);
    } catch {
      w.text("Product image unavailable — it could not be embedded.", {
        size: 9,
        colour: MUTED,
      });
    }
  } else {
    w.text(data.imageNote ?? "Product image unavailable.", { size: 9, colour: MUTED });
  }

  w.move(10);

  /* declarations read */
  w.rule();
  w.text("Declarations read from the label", { size: 13, bold: true });
  w.move(4);

  for (const field of data.fields) {
    w.text(`${field.label}: ${field.value}`, { size: 9.5 });

    // Confidence is only meaningful where something was read.
    if (field.confidence !== null) {
      w.text(`read at ${field.confidence}% confidence`, { size: 8, colour: MUTED, indent: 10 });
    }
  }

  w.move(10);

  /* every requirement, with its reason and citation */
  w.rule();
  w.text("Requirements assessed", { size: 13, bold: true });
  w.move(4);

  for (const requirement of data.requirements) {
    w.text(requirement.label, { size: 10, bold: true });
    w.text(requirement.statusLabel, {
      size: 8.5,
      colour: STATUS_COLOUR[requirement.status] ?? MUTED,
      indent: 10,
    });

    // What the rule asks, then why this outcome followed. A reader who was
    // not present for the inspection needs both to judge the finding.
    if (requirement.requirement) {
      w.text(`Requirement: ${requirement.requirement}`, { size: 9, indent: 10 });
    }
    if (requirement.finding) w.text(`Finding: ${requirement.finding}`, { size: 9, indent: 10 });
    if (requirement.detected) w.text(`Detected: ${requirement.detected}`, { size: 9, indent: 10 });
    if (requirement.legalReference) {
      w.text(requirement.legalReference, { size: 8, colour: MUTED, indent: 10 });
    }

    w.move(4);
  }

  /* Rule 7 — the size of letters and numerals.
     Its own section, because it is a different question from whether a
     declaration is present, and because most of its findings are a stated
     requirement plus a reason the photograph could not settle it. */
  if (data.letterHeight) {
    const rule7 = data.letterHeight;

    w.move(6);
    w.rule();
    w.text("Font / lettering compliance", { size: 13, bold: true });
    w.text(rule7.provision, { size: 8, colour: MUTED });
    w.move(4);

    w.text(
      rule7.requirement.determined && rule7.requirement.minimumHeightMm !== null
        ? `Applicable minimum: ${rule7.requirement.minimumHeightMm} mm`
        : "Applicable minimum: not determined",
      { size: 10, bold: true },
    );
    w.text(rule7.requirement.basis, { size: 8.5, colour: MUTED });

    if (!rule7.scale.available) {
      w.move(3);
      w.text(rule7.scale.note, { size: 8.5, colour: STATUS_COLOUR.review });
    }

    w.move(6);

    for (const finding of rule7.findings) {
      w.text(finding.label, { size: 10, bold: true });
      w.text(`${finding.status.toUpperCase().replace("_", " ")}  ·  evidence ${finding.evidenceConfidence}`, {
        size: 8.5,
        colour: STATUS_COLOUR[finding.status] ?? MUTED,
        indent: 10,
      });

      w.text(`Required: ${finding.requirement}`, { size: 9, indent: 10 });
      if (finding.observed) w.text(`Observed: ${finding.observed}`, { size: 9, indent: 10 });
      w.text(
        `Character height: ${
          finding.characterHeightMm !== null
            ? `approximately ${finding.characterHeightMm} mm`
            : "could not be verified from the photograph"
        }`,
        { size: 9, indent: 10 },
      );
      w.text(`Finding: ${finding.finding}`, { size: 9, indent: 10 });

      // Named in full so it cannot be mistaken for a compliance percentage.
      if (finding.ocrConfidence !== null) {
        w.text(
          `Text recognition confidence: ${Math.round(finding.ocrConfidence * 100)}% ` +
            `(reading confidence, not a measure of lettering compliance)`,
          { size: 8, colour: MUTED, indent: 10 },
        );
      }

      w.text(finding.provision, { size: 8, colour: MUTED, indent: 10 });
      w.move(4);
    }

    w.text(rule7.widthRule, { size: 8.5, colour: MUTED });
  }

  /* what this is not */
  w.move(6);
  w.rule();
  w.text("Scope of this assessment", { size: 13, bold: true });
  w.move(2);
  w.text(data.scope, { size: 9, colour: MUTED });

  if (w.droppedCharacters > 0) {
    w.move(4);
    w.text(
      `Note: ${w.droppedCharacters} character(s) in the source text could not be drawn in this ` +
        `document's font and appear as "?". The on-screen assessment shows them correctly.`,
      { size: 8, colour: MUTED },
    );
  }

  const bytes = await doc.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

/** Builds the PDF and hands it to the browser as a download. */
export async function downloadComplianceReport(data: ReportData): Promise<void> {
  saveBlob(await buildComplianceReport(data), reportFilename(data, "pdf"));
}
