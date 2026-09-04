import { cn } from "@/lib/cn";

/**
 * An accessible on/off switch.
 *
 * The knob is positioned by flex alignment rather than absolute offsets: an
 * absolutely positioned knob inside an inline parent takes its horizontal
 * start from the static position, which drifts and pushes the knob outside
 * the track. `inline-flex` + `items-center` removes that whole class of bug.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  /** Used as the accessible name when the switch has no visible label. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand-600 bg-brand-500" : "border-line-strong bg-line",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[1.4rem]" : "translate-x-[0.2rem]",
        )}
      />
    </button>
  );
}

/** A switch with a label and description, for settings lists. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 transition-colors hover:bg-canvas",
        className,
      )}
    >
      <label className="min-w-0 cursor-pointer" onClick={onChange}>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{hint}</span>}
      </label>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
