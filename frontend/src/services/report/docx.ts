import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { reportFilename, saveBlob, type ReportData, type ReportRequirement } from "./model";

/**
 * The assessment as a real Word document.
 *
 * Built with the `docx` package, which writes the OpenXML a .docx actually
 * is — not HTML given a .docx extension, which Word opens under protest and
 * Google Docs often refuses. The photograph is written into the package as
 * bytes, so the file carries its own evidence and still shows the label on a
 * machine that has never seen this app.
 */

const INK = "16202A";
const MUTED = "6B7784";

const STATUS_COLOUR: Record<string, string> = {
  pass: "22994A",
  fail: "C92A2A",
  review: "B87908",
  not_applicable: MUTED,
};

/** The mark beside each outcome, so a status reads at a glance. */
const STATUS_MARK: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  review: "⚠",
  not_applicable: "—",
};

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 140 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "D8DCE0", space: 6 },
    },
    children: [new TextRun({ text, bold: true, color: INK, size: 26 })],
  });
}

function line(text: string, options: { size?: number; color?: string; bold?: boolean; indent?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    indent: options.indent ? { left: options.indent } : undefined,
    children: [
      new TextRun({
        text,
        bold: options.bold ?? false,
        color: options.color ?? INK,
        size: options.size ?? 20,
      }),
    ],
  });
}

/**
 * The declarations, as a table.
 *
 * A reader comparing a value against its confidence is comparing two columns,
 * and a table is what that comparison is for.
 */
function declarations(data: ReportData): Table {
  const cell = (text: string, bold = false, color = INK) =>
    new TableCell({
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({ children: [new TextRun({ text, bold, color, size: 19 })] }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [cell("Declaration", true), cell("Read from the label", true), cell("Confidence", true)],
      }),
      ...data.fields.map(
        (field) =>
          new TableRow({
            children: [
              cell(field.label),
              cell(field.value, false, field.value === "Not detected" ? MUTED : INK),
              cell(field.confidence === null ? "—" : `${field.confidence}%`, false, MUTED),
            ],
          }),
      ),
    ],
  });
}

function requirement(item: ReportRequirement): Paragraph[] {
  const colour = STATUS_COLOUR[item.status] ?? MUTED;
  const parts: Paragraph[] = [
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({ text: item.label, bold: true, color: INK, size: 21 }),
        new TextRun({
          text: `   ${STATUS_MARK[item.status] ?? ""} ${item.statusLabel}`,
          bold: true,
          color: colour,
          size: 19,
        }),
      ],
    }),
  ];

  if (item.requirement) parts.push(line(`Requirement: ${item.requirement}`, { size: 19, indent: 240 }));
  if (item.finding) parts.push(line(`Finding: ${item.finding}`, { size: 19, indent: 240 }));
  if (item.detected) parts.push(line(`Detected: ${item.detected}`, { size: 19, indent: 240 }));
  if (item.legalReference) {
    parts.push(line(item.legalReference, { size: 17, color: MUTED, indent: 240 }));
  }

  return parts;
}

/**
 * The photograph, sized for the page.
 *
 * Word is given explicit dimensions in points, so the aspect ratio is worked
 * out here rather than left to the reader's client to guess at.
 */
function productImage(data: ReportData): Paragraph {
  if (!data.image) {
    return line(data.imageNote ?? "Product image unavailable.", { size: 19, color: MUTED });
  }

  const maxWidth = 220;
  const maxHeight = 220;
  const scale = Math.min(maxWidth / data.image.width, maxHeight / data.image.height, 1);

  return new Paragraph({
    spacing: { after: 160 },
    children: [
      new ImageRun({
        type: "png",
        data: data.image.bytes,
        transformation: {
          width: Math.round(data.image.width * scale),
          height: Math.round(data.image.height * scale),
        },
      }),
    ],
  });
}

export async function buildWordReport(data: ReportData): Promise<Blob> {
  const doc = new Document({
    title: `NIRIKSHA compliance assessment ${data.scanReference}`,
    creator: "NIRIKSHA",
    description: "Automated compliance assessment for packaged commodities",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: "NIRIKSHA", bold: true, color: INK, size: 44 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "COMPLIANCE ASSESSMENT",
                bold: true,
                color: MUTED,
                size: 22,
                characterSpacing: 40,
              }),
            ],
          }),

          line(`Scan reference: ${data.scanReference}`, { size: 19 }),
          line(`Assessed: ${data.assessedLabel}`, { size: 19, color: MUTED }),

          heading("Assessment"),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `${data.resultLabel} — score ${data.score}`,
                bold: true,
                size: 24,
                color:
                  data.result === "compliant"
                    ? STATUS_COLOUR.pass
                    : data.result === "non_compliant"
                      ? STATUS_COLOUR.fail
                      : STATUS_COLOUR.review,
              }),
            ],
          }),
          line(`Product: ${data.productName}`),
          line(`Net quantity: ${data.netQuantity}`),
          ...(data.qualification
            ? [line(data.qualification, { size: 18, color: STATUS_COLOUR.review })]
            : []),

          heading("Product image"),
          productImage(data),

          heading("Declarations read from the label"),
          declarations(data),

          heading("Requirements assessed"),
          ...data.requirements.flatMap(requirement),

          heading("Scope of this assessment"),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: data.scope, color: MUTED, size: 19 })],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadWordReport(data: ReportData): Promise<void> {
  saveBlob(await buildWordReport(data), reportFilename(data, "docx"));
}
