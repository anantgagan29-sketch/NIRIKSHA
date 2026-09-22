import { useState } from "react";
import { ChevronDown, Download, FileImage, FileText, FileType, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { DemoProduct } from "@/data/types";
import { buildReportData } from "@/services/report/model";
import { reportLocale } from "@/services/report/locale";
import { registerReport } from "@/services/report/registry";
import { ReportLanguageDialog } from "@/components/report/ReportLanguageDialog";

/**
 * The download control: one assessment, four files.
 *
 * Every format is rendered from the same report data, built once here, so the
 * PDF, the Word document and the picture describe the same inspection and
 * cannot disagree about it. The formats differ only in how they draw it.
 */

type Format = "pdf" | "docx" | "png" | "jpeg";

const FORMATS: {
  id: Format;
  label: string;
  hint: string;
  busy: string;
  icon: typeof FileText;
}[] = [
  { id: "pdf", label: "PDF", hint: "Printable, multi-page", busy: "Generating PDF…", icon: FileText },
  { id: "docx", label: "Word document", hint: ".docx, editable", busy: "Generating Word report…", icon: FileType },
  { id: "png", label: "Image (PNG)", hint: "Whole report, one picture", busy: "Generating image…", icon: FileImage },
  { id: "jpeg", label: "Image (JPG)", hint: "Smaller file", busy: "Generating image…", icon: FileImage },
];

// Module-level so the dialog receives the same array each render and its
// "reset on open" effect does not re-run on every parent render.
const FORMAT_OPTIONS = FORMATS.map(({ id, label, hint }) => ({ id, label, hint }));

export function DownloadReportMenu({
  product,
  variant = "secondary",
}: {
  product: DemoProduct;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  // Open while the language and format are being chosen. The document is
  // not made until the dialog answers; nothing about the screen's language
  // is consulted in between.
  const [asking, setAsking] = useState(false);
  const toast = useToast();

  async function download(format: Format, language: string) {
    // Guarded rather than merely disabled: a second click that lands before
    // React has re-rendered would otherwise start a second generation and
    // hand the reader two copies of the same file.
    if (busy) return;

    setBusy(format);

    try {
      // The document in the language that was asked for — never the
      // screen's language unless that is what was chosen.
      const data = await buildReportData(product, reportLocale(language));

      // The document writers are loaded when one is asked for, not when the
      // page is. Between them pdf-lib and docx are a large part of what the
      // browser had to download before anything could be shown, and most
      // visits never generate a report at all.
      if (format === "pdf") {
        const { downloadComplianceReport } = await import("@/services/reportPdf");
        await downloadComplianceReport(data);
      } else if (format === "docx") {
        const { downloadWordReport } = await import("@/services/report/docx");
        await downloadWordReport(data);
      } else {
        const { downloadImageReport } = await import("@/services/report/image");
        await downloadImageReport(data, format);
      }

      setAsking(false);
      toast("success", `Report downloaded as ${format === "docx" ? "a Word document" : format.toUpperCase()}.`);

      // Recorded after the file is in the reader's hands, and never in the
      // way of it: the history shows which language each scan was last
      // reported in, and a failure to note that is not a failure to report.
      void registerReport(product.scanId, language, format);
    } catch (cause) {
      // Reported, never thrown onwards: a failed export must not take the
      // assessment screen down with it.
      console.error("Report generation failed.", cause);
      toast(
        "warning",
        cause instanceof Error ? cause.message : "The report could not be generated.",
      );
    } finally {
      setBusy(null);
    }
  }

  const current = FORMATS.find((format) => format.id === busy);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setAsking(true)}
        disabled={busy !== null}
        aria-haspopup="dialog"
        aria-expanded={asking}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {current ? current.busy : "Download Report"}
        {!busy && <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
      </Button>

      {/* One dialog settles both questions — which language, which file —
          so a download is always asked about, whatever language the screen
          happens to be in. */}
      <ReportLanguageDialog
        open={asking}
        busy={busy !== null}
        formatLabel="PDF"
        formats={FORMAT_OPTIONS}
        onClose={() => setAsking(false)}
        onConfirm={(language, format) => void download(format as Format, language)}
      />
    </>
  );
}
