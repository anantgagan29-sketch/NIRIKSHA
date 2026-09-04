import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  tone = "brand",
  indeterminate = false,
}: {
  value: number;
  className?: string;
  tone?: "brand" | "pass" | "review" | "fail";
  /** Work is happening but its extent is unknown — show motion, not a number. */
  indeterminate?: boolean;
}) {
  const fill = {
    brand: "bg-brand-500",
    pass: "bg-pass",
    review: "bg-review",
    fail: "bg-fail",
  }[tone];

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={indeterminate ? "Working" : undefined}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className={cn(
          "h-full rounded-full",
          indeterminate ? "nk-indeterminate" : "transition-[width] duration-500 ease-out",
          fill,
        )}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** The quality score dial. Stroke-drawn so it scales and recolours cleanly. */
export function ScoreRing({
  value,
  label,
  size = 96,
  tone = "brand",
}: {
  value: number;
  label?: string;
  size?: number;
  tone?: "brand" | "pass" | "review" | "fail";
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  const colour = {
    brand: "var(--color-brand-500)",
    pass: "var(--color-pass)",
    review: "var(--color-review)",
    fail: "var(--color-fail)",
  }[tone];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-display text-xl font-semibold text-ink">{Math.round(value)}%</span>
        {label && <span className="text-[10px] text-muted">{label}</span>}
      </div>
    </div>
  );
}
