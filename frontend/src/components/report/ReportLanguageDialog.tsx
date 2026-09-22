import { useEffect, useMemo, useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import {
  REPORT_LANGUAGES,
  rememberReportLanguage,
  rememberedReportLanguage,
  reportLanguage,
} from "@/i18n/reportLanguages";
import { reportLocale } from "@/services/report/locale";
import { cn } from "@/lib/cn";

/**
 * Asks which language a report should be written in.
 *
 * Shown every time a report is requested, and never answered from the
 * interface language: an inspector reading the screen in Hindi may need an
 * English document, and the other way round. The dialog's own wording is in
 * the interface language; the language offered as the default is whichever
 * was chosen last time, or English.
 *
 * While the document is being made, the progress line is written in the
 * language the document will be in — the first thing the reader sees of it.
 */
export function ReportLanguageDialog({
  open,
  onClose,
  onConfirm,
  busy,
  formatLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen language code; the caller makes the document. */
  onConfirm: (language: string) => void;
  /** True while the document is being generated; the dialog then waits. */
  busy: boolean;
  /** What is about to be made — "PDF", "Word document" — for the button. */
  formatLabel: string;
}) {
  const { t, language: interfaceLanguage } = useLanguage();
  const [selected, setSelected] = useState<string>(() => rememberedReportLanguage());

  // Re-read the remembered default each time the dialog opens, so a choice
  // made from another screen is the default here too.
  useEffect(() => {
    if (open) setSelected(rememberedReportLanguage());
  }, [open]);

  const interfaceName = useMemo(() => reportLanguage(interfaceLanguage), [interfaceLanguage]);
  const chosen = reportLanguage(selected);

  // The progress line, in the report's language rather than the screen's.
  const generating = reportLocale(selected).t("report.generating", { language: chosen.nativeName });

  function confirm() {
    rememberReportLanguage(selected);
    onConfirm(selected);
  }

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={t("reportDialog.title")}>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed text-ink">{t("reportDialog.hint")}</p>
            <p className="mt-1 text-[12px] text-muted">
              {t("reportDialog.current")}: <span className="text-ink">{interfaceName.nativeName}</span>
            </p>
          </div>
        </div>

        {/* A radio group, drawn as cards. Arrow keys move between them and
            space selects, because the real inputs are in the DOM. */}
        <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3" disabled={busy}>
          <legend className="sr-only">{t("reportDialog.title")}</legend>
          {REPORT_LANGUAGES.map((option) => {
            const on = option.code === selected;
            return (
              <label
                key={option.code}
                lang={option.code}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition-colors",
                  "focus-within:ring-2 focus-within:ring-brand-500/40",
                  on ? "border-brand-600 bg-brand-50" : "border-line bg-canvas hover:border-line-strong",
                  busy && "cursor-default opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="report-language"
                  value={option.code}
                  checked={on}
                  onChange={() => setSelected(option.code)}
                  className="sr-only"
                />
                <span className={cn("text-[14px] leading-tight", on ? "font-semibold text-ink" : "font-medium text-ink")}>
                  {option.nativeName}
                </span>
                <span className="text-[11px] text-muted">{option.name}</span>
                {on && (
                  <Check
                    className="absolute right-2 top-2 h-3.5 w-3.5 text-brand-700"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                )}
              </label>
            );
          })}
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p
            lang={selected}
            className="min-h-[1.25rem] text-[12.5px] text-muted"
            aria-live="polite"
          >
            {busy ? generating : `${t("history.reportLanguage")}: ${chosen.nativeName} · ${chosen.name}`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("reportDialog.generate")} · {formatLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
