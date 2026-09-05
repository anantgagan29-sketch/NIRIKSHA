import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileImage, FileText, FileType, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { DemoProduct } from "@/data/types";
import { buildReportData } from "@/services/report/model";
import { downloadComplianceReport } from "@/services/reportPdf";
import { downloadWordReport } from "@/services/report/docx";
import { downloadImageReport } from "@/services/report/image";

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

export function DownloadReportMenu({
  product,
  variant = "secondary",
}: {
  product: DemoProduct;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  // A menu that stays open after the pointer has moved on is a menu in the
  // way. Escape closes it too, because the keyboard has to reach everything
  // the mouse does.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function download(format: Format) {
    // Guarded rather than merely disabled: a second click that lands before
    // React has re-rendered would otherwise start a second generation and
    // hand the reader two copies of the same file.
    if (busy) return;

    setBusy(format);

    try {
      const data = await buildReportData(product);

      if (format === "pdf") await downloadComplianceReport(data);
      else if (format === "docx") await downloadWordReport(data);
      else await downloadImageReport(data, format);

      setOpen(false);
      toast("success", `Report downloaded as ${format === "docx" ? "a Word document" : format.toUpperCase()}.`);
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
    <div className="relative" ref={container}>
      <Button
        variant={variant}
        onClick={() => setOpen((value) => !value)}
        disabled={busy !== null}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {current ? current.busy : "Download Report"}
        {!busy && <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-lg"
        >
          {FORMATS.map((format) => (
            <button
              key={format.id}
              role="menuitem"
              type="button"
              disabled={busy !== null}
              onClick={() => void download(format.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-50"
            >
              <format.icon className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{format.label}</span>
                <span className="block text-xs text-muted">{format.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
