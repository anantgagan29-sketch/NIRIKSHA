import { Check } from "lucide-react";

import { SELECTABLE_FIELDS, ALL_FIELD_IDS, isAllFields } from "@/services/fieldSelection";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Choosing what this inspection is about.
 *
 * Most inspections have a question behind them — a consignment checked for
 * expiry dates, a price complaint — and a report that answers every question
 * buries the one that was asked. So the choice is made before the scan, and
 * it decides what the assessment covers, not merely what is shown afterwards.
 *
 * Everything selected is the same request as nothing selected, so "All
 * Fields" is a shortcut rather than a separate mode: the assessment it
 * produces is the one this system has always produced.
 *
 * The label is still read whole either way — the reading costs the same, and
 * discarding text already in hand would only make the answer worse.
 */
export function FieldSelector({
  selected,
  onChange,
  className,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const all = isAllFields(selected);
  const { label } = useLanguage();

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((f) => f !== id) : [...selected, id]);
  }

  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="sr-only">What do you want to check?</legend>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] font-medium text-ink">What do you want to check?</p>
        <button
          type="button"
          onClick={() => onChange(all ? [] : ALL_FIELD_IDS)}
          className="text-[12.5px] font-medium text-brand-700 hover:underline"
        >
          {all ? "Clear all" : "Select all fields"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SELECTABLE_FIELDS.map((field) => {
          const on = selected.includes(field.id);

          return (
            <label
              key={field.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                on
                  ? "border-brand-400 bg-brand-50"
                  : "border-line bg-surface hover:border-line-strong hover:bg-canvas",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(field.id)}
                className="sr-only"
              />
              {/* Drawn rather than native, to match the rest of the console —
                  the real input stays in the DOM for keyboard and assistive
                  technology, which is why the label wraps it. */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors",
                  on ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-surface",
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>

              <span className="flex min-w-0 flex-col">
                <span className={cn("text-[13.5px]", on ? "font-medium text-ink" : "text-ink")}>
                  {label("field", field.id, field.label)}
                </span>
                <span className="text-[11.5px] leading-relaxed text-muted">{field.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Says what the choice will do, in the terms of the result it produces. */}
      <p className="text-[12px] leading-relaxed text-muted" role="status">
        {selected.length === 0
          ? "Choose at least one declaration to assess."
          : all
            ? "Every applicable requirement will be assessed, and the report will carry all of them."
            : `The assessment and the report will cover ${selected.length === 1 ? "this declaration" : `these ${selected.length} declarations`}. The label is still read in full — anything found outside the selection is reported separately, never as a pass.`}
      </p>
    </fieldset>
  );
}
