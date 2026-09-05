import { Check, X, AlertTriangle, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CheckStatus, ComplianceResult, FieldStatus, QualityVerdict } from "@/data/types";

/**
 * The single place compliance status becomes colour.
 *
 * Green passes, red fails, amber needs a person, slate does not apply — and no
 * decorative element is ever allowed those three semantic colours. Every pill
 * also carries a text label and an icon, so status is never communicated by
 * colour alone.
 */

export type Tone = "pass" | "fail" | "review" | "na" | "neutral" | "busy";

const TONES: Record<Tone, string> = {
  pass: "bg-pass-bg text-pass border-pass/25",
  fail: "bg-fail-bg text-fail border-fail/25",
  review: "bg-review-bg text-review border-review/25",
  na: "bg-canvas text-na border-line-strong",
  neutral: "bg-canvas text-muted border-line",
  busy: "bg-brand-50 text-brand-700 border-brand-200",
};

const ICONS: Record<Tone, typeof Check> = {
  pass: Check,
  fail: X,
  review: AlertTriangle,
  na: Minus,
  neutral: Minus,
  busy: Loader2,
};

export function StatusPill({
  tone,
  label,
  size = "md",
  className,
}: {
  tone: Tone;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", tone === "busy" && "animate-spin")} />
      {label}
    </span>
  );
}

export const checkPill = (status: CheckStatus): { tone: Tone; label: string } =>
  ({
    pass: { tone: "pass" as const, label: "Pass" },
    fail: { tone: "fail" as const, label: "Fail" },
    review: { tone: "review" as const, label: "Needs Review" },
    not_applicable: { tone: "na" as const, label: "Not Applicable" },
  })[status];

export const fieldPill = (status: FieldStatus): { tone: Tone; label: string } =>
  ({
    detected: { tone: "pass" as const, label: "Detected" },
    needs_review: { tone: "review" as const, label: "Needs Review" },
    missing: { tone: "fail" as const, label: "Not Detected" },
  })[status];

export const resultPill = (result: ComplianceResult): { tone: Tone; label: string } =>
  ({
    compliant: { tone: "pass" as const, label: "Compliant" },
    non_compliant: { tone: "fail" as const, label: "Non-Compliant" },
    needs_review: { tone: "review" as const, label: "Needs Review" },
  })[result];

export const qualityPill = (verdict: QualityVerdict): { tone: Tone; label: string } =>
  ({
    good: { tone: "pass" as const, label: "Good" },
    marginal: { tone: "review" as const, label: "Marginal" },
    poor: { tone: "fail" as const, label: "Poor" },
  })[verdict];
