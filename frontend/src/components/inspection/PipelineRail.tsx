import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Loader2, Circle } from "lucide-react";
import { PIPELINE_STAGES } from "@/data/pipeline";
import { cn } from "@/lib/cn";
import type { StageState } from "@/data/types";

/**
 * The six-stage inspection rail.
 *
 * Every stage shows its own state, so a person watching knows exactly where
 * the work is and, when something goes wrong, which step it went wrong at.
 */

const ICONS: Record<StageState, typeof Check> = {
  pending: Circle,
  processing: Loader2,
  complete: Check,
  warning: AlertTriangle,
  failed: X,
};

const RING: Record<StageState, string> = {
  pending: "border-line bg-surface text-faint",
  processing: "border-brand-300 bg-brand-50 text-brand-600",
  complete: "border-pass/30 bg-pass-bg text-pass",
  warning: "border-review/30 bg-review-bg text-review",
  failed: "border-fail/30 bg-fail-bg text-fail",
};

const LABEL: Record<StageState, string> = {
  pending: "Pending",
  processing: "Processing",
  complete: "Completed",
  warning: "Completed with warnings",
  failed: "Failed",
};

export function PipelineRail({
  stages,
  compact,
  className,
}: {
  stages: Record<string, StageState>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {PIPELINE_STAGES.map((stage, index) => {
        const state = stages[stage.id] ?? "pending";
        const Icon = ICONS[state];
        const last = index === PIPELINE_STAGES.length - 1;

        return (
          <li key={stage.id} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <motion.span
                animate={state === "processing" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ repeat: state === "processing" ? Infinity : 0, duration: 1.6 }}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  RING[state],
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    state === "processing" && "animate-spin",
                    state === "pending" && "h-2 w-2 fill-current",
                  )}
                  aria-hidden="true"
                />
              </motion.span>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "my-1 w-px flex-1 transition-colors",
                    state === "complete" || state === "warning" ? "bg-brand-300" : "bg-line",
                  )}
                />
              )}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : compact ? "pb-3.5" : "pb-5")}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] text-brand-600">{stage.index}</span>
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "pending" ? "text-faint" : "text-ink",
                  )}
                >
                  {stage.title}
                </p>
                <span className="sr-only">{LABEL[state]}</span>
              </div>
              {!compact && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{stage.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
