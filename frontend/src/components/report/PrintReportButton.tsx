import { useState } from "react";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/hooks/useLanguage";
import type { DemoProduct } from "@/data/types";
import { buildReportData } from "@/services/report/model";
import { reportLocale } from "@/services/report/locale";
import { registerReport } from "@/services/report/registry";
import { ReportLanguageDialog } from "@/components/report/ReportLanguageDialog";

/**
 * Prints the report — in a language of the reader's choosing.
 *
 * window.print() would print the screen, in the screen's language. Instead
 * the same PDF the download produces is built in the chosen language and
 * handed to the printer, so the printed page and the downloaded file are
 * one document and the language question is asked here too.
 */
export function PrintReportButton({ product }: { product: DemoProduct }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function print(language: string) {
    if (busy) return;
    setBusy(true);

    try {
      const data = await buildReportData(product, reportLocale(language));
      const { buildComplianceReport } = await import("@/services/reportPdf");
      const blob = await buildComplianceReport(data);
      const url = URL.createObjectURL(blob);

      // Loaded into a frame the reader never sees, and printed from there.
      // Chrome prints the PDF the frame holds; a browser that will not is
      // given the document in a tab of its own to print from.
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      frame.src = url;

      const printed = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 4000);
        frame.onload = () => {
          clearTimeout(timer);
          // The viewer reports load before it has drawn the first page;
          // printing at once prints an empty sheet.
          setTimeout(() => {
            try {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
              resolve(true);
            } catch {
              resolve(false);
            }
          }, 700);
        };
        document.body.appendChild(frame);
      });

      if (!printed) {
        window.open(url, "_blank", "noopener");
      }

      // The frame stays until the print dialog has had its say; the URL is
      // released well after that.
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);

      setAsking(false);
      void registerReport(product.scanId, language, "pdf");
    } catch (cause) {
      console.error("Print failed.", cause);
      toast("warning", cause instanceof Error ? cause.message : "The report could not be prepared for printing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setAsking(true)} disabled={busy} aria-haspopup="dialog">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Printer className="h-4 w-4" aria-hidden="true" />
        )}
        {t("common.print")}
      </Button>

      <ReportLanguageDialog
        open={asking}
        busy={busy}
        formatLabel={t("common.print")}
        onClose={() => setAsking(false)}
        onConfirm={(language) => void print(language)}
      />
    </>
  );
}
