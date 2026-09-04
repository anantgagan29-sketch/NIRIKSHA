import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Drawer } from "@/components/ui/Modal";
import { StatusPill, checkPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/cn";
import type { ComplianceCheck } from "@/data/types";

/**
 * Field-level compliance checks.
 *
 * Every row is selectable and opens the full reasoning behind its outcome:
 * what the rule required, what was detected, how confident the reading was,
 * the supporting text, and the provision it comes from. A verdict a person
 * cannot interrogate is not explainable, whatever it is called.
 */
export function CheckList({ checks, className }: { checks: ComplianceCheck[]; className?: string }) {
  const [active, setActive] = useState<ComplianceCheck | null>(null);

  return (
    <>
      <ul className={cn("divide-y divide-[var(--color-line)]", className)}>
        {checks.map((check, index) => {
          const pill = checkPill(check.status);
          return (
            <motion.li
              key={check.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.28 }}
            >
              <button
                type="button"
                onClick={() => setActive(check)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-canvas",
                  check.status === "fail" && "bg-fail-bg/40",
                )}
              >
                <StatusPill {...pill} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{check.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {check.detected ?? (check.status === "not_applicable" ? "Does not apply to this package" : "Not detected")}
                  </span>
                </span>
                <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:block">
                  {check.provision}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </motion.li>
          );
        })}
      </ul>

      <Drawer open={Boolean(active)} onClose={() => setActive(null)} title="Rule evidence">
        {active && <Evidence check={active} />}
      </Drawer>
    </>
  );
}

function Evidence({ check }: { check: ComplianceCheck }) {
  const pill = checkPill(check.status);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-2.5">
        <StatusPill {...pill} className="self-start" />
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">{check.label}</h3>
        <p className="font-mono text-[11px] text-muted">
          {check.instrument} — {check.provision}
        </p>
      </div>

      <Row label="Reason">{check.reason}</Row>
      <Row label="What the rule requires">{check.requirement}</Row>
      <Row label="Detected value">
        {check.detected ?? <span className="text-faint">Not detected</span>}
      </Row>

      {check.confidence !== null && (
        <Row label="Reading confidence">
          <span className="tnum font-mono">{check.confidence}%</span>
          {check.confidence < 70 && (
            <span className="ml-2 text-review">— below the threshold at which a value is relied on</span>
          )}
        </Row>
      )}

      {check.evidence && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Evidence from the image</p>
          <p className="rounded-lg border-l-2 border-brand-300 bg-canvas px-3.5 py-2.5 font-mono text-xs leading-relaxed text-ink-2">
            “{check.evidence}”
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Source</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-700">
            {check.provision}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase text-faint">Severity: {check.severity}</p>
      </div>

      <p className="rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
        This is an automated assessment produced from an image. It is not a statutory determination
        and needs verification by a person before it is acted on.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
