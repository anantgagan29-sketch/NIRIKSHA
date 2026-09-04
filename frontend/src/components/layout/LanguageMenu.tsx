import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import { findLanguage } from "@/i18n/languages";
import { cn } from "@/lib/cn";

/**
 * Choosing the interface language.
 *
 * All twenty languages are listed, but the eighteen without a dictionary are
 * shown as not ready rather than hidden. Hiding them would suggest NIRIKSHA
 * only ever intends to speak two languages; offering them and then switching
 * to an English interface would be worse still. Saying "coming soon" is the
 * only version that tells the truth.
 *
 * The panel is a popover rather than a page: changing language is a small
 * decision and should not cost someone their place in the application.
 */
export function LanguageMenu() {
  const { language, setLanguage, t, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = findLanguage(language);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The "coming soon" note belongs to one language at a time, and should not
  // still be showing when the panel is opened again.
  useEffect(() => {
    if (!open) setRefused(null);
  }, [open]);

  function choose(code: string, supported: boolean) {
    if (!supported) {
      setRefused(code);
      return;
    }

    setLanguage(code);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("topbar.language")} — ${t("topbar.languageCurrent")}: ${current?.english ?? language}`}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors",
          open ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-canvas hover:text-ink",
        )}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-[7rem] truncate">{current?.native ?? language}</span>
      </button>

      {/* On a phone the panel is pinned to the viewport rather than to the
          button: anchored to a button that sits near the right edge, a panel
          this wide hangs off the left side of the screen. From `sm` up there
          is room, so it goes back to hanging under its button. */}
      {open && (
        <div
          role="listbox"
          aria-label={t("language.title")}
          className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[19rem]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">{t("language.title")}</p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1.5">
            {languages.map((option, index) => {
              const active = option.code === language;
              const previous = languages[index - 1];

              // One heading before the first of each group, so the divide
              // between what works and what does not is visible at a glance.
              const heading =
                index === 0
                  ? t("language.available")
                  : previous?.supported && !option.supported
                    ? t("language.more")
                    : null;

              return (
                <div key={option.code}>
                  {heading && (
                    <p className="px-4 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                      {heading}
                    </p>
                  )}

                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={!option.supported}
                    onClick={() => choose(option.code, option.supported)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      active ? "bg-brand-50" : "hover:bg-canvas",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "truncate text-[13.5px]",
                          option.supported ? "text-ink" : "text-muted",
                          active && "font-medium text-brand-700",
                        )}
                      >
                        {option.native}
                      </span>
                      <span className="truncate text-[11.5px] text-faint">{option.english}</span>
                    </span>

                    {active ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-brand-700">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("language.active")}
                      </span>
                    ) : (
                      !option.supported && (
                        <span className="shrink-0 rounded-full border border-line bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-muted">
                          {t("language.comingSoon")}
                        </span>
                      )
                    )}
                  </button>

                  {/* Shown against the language that was asked for, so it is
                      obvious which choice did not take effect. */}
                  {refused === option.code && (
                    <p
                      role="status"
                      className="mx-4 mb-2 mt-1 rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted"
                    >
                      {t("language.comingSoonNote", { current: current?.native ?? language })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
