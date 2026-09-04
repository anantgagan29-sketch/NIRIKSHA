import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAccessibility } from "@/hooks/useAccessibility";
import { cn } from "@/lib/cn";
import type { ComplianceCheck, ComplianceResult } from "@/data/types";

const COPY: Record<ComplianceResult, { title: string; blurb: string; icon: typeof CheckCircle2 }> = {
  compliant: {
    title: "COMPLIANT",
    blurb: "All applicable declarations were detected and met the requirements that govern this package.",
    icon: CheckCircle2,
  },
  non_compliant: {
    title: "NON-COMPLIANT",
    blurb: "At least one requirement that applies to this package appears not to be met.",
    icon: XCircle,
  },
  needs_review: {
    title: "NEEDS REVIEW",
    blurb: "Some checks could not be settled automatically and need confirmation by a person.",
    icon: AlertTriangle,
  },
};

const TONE: Record<ComplianceResult, string> = {
  compliant: "from-pass to-brand-600 border-pass/30",
  non_compliant: "from-fail to-[#9b1c1c] border-fail/30",
  needs_review: "from-review to-[#92400e] border-review/30",
};

/**
 * The headline outcome.
 *
 * It never appears without its qualification: this is an automated assessment,
 * and the counts beneath it are what the assessment is actually made of.
 */
export function ResultBanner({
  result,
  checks,
  score,
  className,
}: {
  result: ComplianceResult;
  checks: ComplianceCheck[];
  score?: number;
  className?: string;
}) {
  const { speak, speaking, speechSupported } = useAccessibility();
  const copy = COPY[result];
  const Icon = copy.icon;

  const counts = {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    review: checks.filter((c) => c.status === "review").length,
    na: checks.filter((c) => c.status === "not_applicable").length,
  };

  const spoken = [
    `NIRIKSHA automated compliance assessment. Result: ${copy.title.toLowerCase()}.`,
    `${counts.pass} checks passed, ${counts.fail} failed, ${counts.review} need review, and ${counts.na} did not apply to this package.`,
    ...checks.filter((c) => c.status === "fail").map((c) => `Failed check: ${c.label}. ${c.reason}`),
    "This is an automated assessment from an image. It is not a statutory determination and it is not a government certification.",
  ].join(" ");

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border bg-surface", TONE[result], className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className={cn("flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r px-5 py-5 text-white", TONE[result])}
      >
        <div className="flex items-center gap-3.5">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            aria-hidden="true"
          >
            <Icon className="h-9 w-9" />
          </motion.span>
          <div>
            <p className="font-display text-xl font-bold tracking-wide sm:text-2xl">{copy.title}</p>
            <p className="mt-0.5 max-w-lg text-[13px] leading-relaxed text-white/85">{copy.blurb}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {score !== undefined && (
            <div className="text-right">
              <p className="tnum font-display text-3xl font-bold leading-none">{score}</p>
              <p className="text-[10.5px] uppercase tracking-wider text-white/70">Assessment score</p>
            </div>
          )}
          {speechSupported && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => speak(spoken)}
              className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:border-white/40"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              {speaking ? "Stop" : "Read result"}
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 divide-x divide-[var(--color-line)] border-t border-line sm:grid-cols-4">
        <Count label="Passed" value={counts.pass} tone="text-pass" />
        <Count label="Failed" value={counts.fail} tone="text-fail" />
        <Count label="Needs review" value={counts.review} tone="text-review" />
        <Count label="Not applicable" value={counts.na} tone="text-na" />
      </div>

      <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-muted">
        Automated compliance assessment. The score is a severity-weighted summary of the checks
        below, excluding requirements that do not apply to this package — it is not a legal
        certification and carries no statutory weight.
      </p>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className={cn("tnum font-display text-xl font-semibold", tone)}>{value}</p>
    </div>
  );
}
