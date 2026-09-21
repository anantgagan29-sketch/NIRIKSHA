/**
 * Text in Indian scripts, for a PDF built with pdf-lib.
 *
 * pdf-lib's standard fonts encode WinAnsi only, and even an embedded TrueType
 * font would not help: Devanagari, Bengali, Tamil and the rest need OpenType
 * shaping — conjuncts, reordered vowel signs, contextual forms — which
 * pdf-lib does not perform. The browser does, through the same Noto faces
 * the interface already loads. So each line of non-Latin text is set by the
 * browser on a canvas and embedded as a small image, at a resolution that
 * prints cleanly. The English report keeps its real text path untouched.
 *
 * Urdu is right-to-left; the canvas is told so and the line is aligned to
 * the right edge, which is where a reader of it starts.
 */

const FAMILY: Record<string, string> = {
  bn: "Noto Sans Bengali",
  as: "Noto Sans Bengali",
  ta: "Noto Sans Tamil",
  te: "Noto Sans Telugu",
  kn: "Noto Sans Kannada",
  ml: "Noto Sans Malayalam",
  gu: "Noto Sans Gujarati",
  pa: "Noto Sans Gurmukhi",
  or: "Noto Sans Oriya",
  ur: "Noto Nastaliq Urdu",
};

const DEVANAGARI = new Set(["hi", "mr", "ne", "sa", "kok", "mai", "ks", "sd", "doi"]);

/** True when a language's text cannot be drawn with the standard PDF fonts. */
export function needsScriptRendering(language: string): boolean {
  return language !== "en";
}

export function isRightToLeft(language: string): boolean {
  return language === "ur";
}

function familyFor(language: string): string {
  const own = DEVANAGARI.has(language) ? "Noto Sans Devanagari" : FAMILY[language];
  // DM Sans behind it for the Latin terms a translation keeps (OCR, MRP),
  // and the system behind that if the web font never arrived.
  return [own, "DM Sans", "system-ui", "sans-serif"].filter(Boolean).map((f) => `"${f}"`).join(", ");
}

/** Pixels per PDF point in the rendered line; 3 keeps print output crisp. */
const SCALE = 3;
// Indic and Nastaliq glyphs reach well above and below the Latin em box.
const ASCENT = 1.1;
const DESCENT = 0.55;

export interface RenderedLine {
  /** JPEG bytes, despite the name kept from the first version. */
  png: Uint8Array;
  /** In PDF points. */
  width: number;
  height: number;
  /** Where the baseline sits below the top of the image, in points. */
  baseline: number;
}

/**
 * Sets text in the browser's fonts and wraps it to `maxWidth` points.
 *
 * Fonts are awaited first: a canvas drawn before the web font is in falls
 * back to whatever the system has, which for a rarer script may be nothing.
 */
export class ScriptText {
  private readonly language: string;
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;

  constructor(language: string) {
    this.language = language;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to render this script.");
    this.context = context;
  }

  async ready(): Promise<void> {
    try {
      await document.fonts.load(`16px ${familyFor(this.language)}`);
      await document.fonts.ready;
    } catch {
      // Whatever the browser has will be used.
    }
  }

  private font(size: number, bold: boolean): string {
    return `${bold ? 600 : 400} ${size * SCALE}px ${familyFor(this.language)}`;
  }

  measure(text: string, size: number, bold: boolean): number {
    this.context.font = this.font(size, bold);
    return this.context.measureText(text).width / SCALE;
  }

  wrap(text: string, size: number, bold: boolean, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = "";

    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.measure(candidate, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  /**
   * Sets a whole paragraph — wrapped to `maxWidth` — as one image.
   *
   * One image per paragraph rather than per line, and JPEG rather than
   * PNG: pdf-lib decodes every PNG it embeds in JavaScript, and a report
   * of a hundred lines took half a minute that way. A JPEG is embedded as
   * it is. The page is white, so the opaque background costs nothing.
   */
  async render(
    text: string,
    size: number,
    bold: boolean,
    colour: [number, number, number],
    maxWidth: number,
  ): Promise<RenderedLine> {
    const rtl = isRightToLeft(this.language);
    const lines = this.wrap(text, size, bold, maxWidth);
    const lineHeight = size * (ASCENT + DESCENT);
    const width = Math.min(
      maxWidth,
      Math.max(1, ...lines.map((line) => this.measure(line, size, bold))),
    );
    const height = lineHeight * lines.length;

    this.canvas.width = Math.ceil(width * SCALE);
    this.canvas.height = Math.ceil(height * SCALE);

    const context = this.context;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.font = this.font(size, bold);
    context.fillStyle = `rgb(${colour.map((c) => Math.round(c * 255)).join(",")})`;
    context.textBaseline = "alphabetic";
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";

    lines.forEach((line, index) => {
      context.fillText(
        line,
        rtl ? this.canvas.width : 0,
        (index * lineHeight + size * ASCENT) * SCALE,
      );
    });

    const blob: Blob | null = await new Promise((resolve) =>
      this.canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("The rendered text could not be encoded.");

    return {
      png: new Uint8Array(await blob.arrayBuffer()),
      width,
      height,
      baseline: size * ASCENT,
    };
  }
}
