import { useEffect, useRef, useState } from "react";
import { Accessibility, Check } from "lucide-react";
import { SwitchRow } from "@/components/ui/Switch";
import { useAccessibility, type TextSize } from "@/hooks/useAccessibility";
import { cn } from "@/lib/cn";

const SIZES: { value: TextSize; label: string }[] = [
  { value: "base", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

export function AccessibilityMenu() {
  const { textSize, setTextSize, highContrast, toggleContrast, reduceMotion, toggleMotion } =
    useAccessibility();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Accessibility options"
        className="rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <Accessibility className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Text size</p>
          <div className="flex flex-col gap-0.5">
            {SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => setTextSize(size.value)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-canvas",
                  textSize === size.value ? "font-medium text-brand-700" : "text-ink-2",
                )}
              >
                {size.label}
                {textSize === size.value && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="my-2 h-px bg-line" />

          <SwitchRow label="High contrast" checked={highContrast} onChange={toggleContrast} />
          <SwitchRow label="Reduce motion" checked={reduceMotion} onChange={toggleMotion} />

          <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
            Result screens can also be read aloud from the assessment header.
          </p>
        </div>
      )}
    </div>
  );
}
