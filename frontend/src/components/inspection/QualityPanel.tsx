import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill, qualityPill } from "@/components/ui/StatusPill";
import { ScoreRing } from "@/components/ui/Progress";
import type { ImageQuality } from "@/data/types";

/**
 * The quality gate.
 *
 * It reports what was measured, not merely whether it passed, so a rejection
 * can be understood and acted on. When the frame is unusable the panel blocks
 * the workflow outright — reading text from an unreadable image produces a
 * confident-looking result from nothing, which is worse than asking again.
 */
export function QualityPanel({
  quality,
  onContinue,
  onRetake,
  busy,
}: {
  quality: ImageQuality;
  onContinue?: () => void;
  onRetake?: () => void;
  busy?: boolean;
}) {
  const tone = quality.verdict === "good" ? "pass" : quality.verdict === "marginal" ? "review" : "fail";

  return (
    <Card>
      <CardHeader
        title="Image Quality"
        action={<StatusPill {...qualityPill(quality.verdict)} size="sm" />}
      />

      <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ul className="flex flex-1 flex-col gap-3">
          {quality.metrics.map((metric, index) => (
            <motion.li
              key={metric.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.07, duration: 0.3 }}
              className="flex items-start gap-3"
            >
              <StatusPill {...qualityPill(metric.verdict)} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">{metric.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{metric.detail}</p>
              </div>
            </motion.li>
          ))}
        </ul>

        <div className="flex shrink-0 flex-col items-center gap-1 sm:pl-4">
          <ScoreRing value={quality.score} tone={tone} />
          <p className="text-[11px] font-medium text-muted">Quality Score</p>
        </div>
      </CardBody>

      {quality.note && quality.proceed && (
        <div className="mx-5 mb-4 flex gap-2.5 rounded-lg border border-review/25 bg-review-bg px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-review" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-2">{quality.note}</p>
        </div>
      )}

      {!quality.proceed && (
        <div className="mx-5 mb-4 rounded-lg border border-fail/25 bg-fail-bg px-4 py-3.5" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-fail">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Image quality is too low for reliable extraction
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
            The label appears blurred, so recognition would be unreliable and the assessment was not
            run. Fill the frame with the declaration panel, hold steady, and avoid direct glare.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-3.5">
        {quality.proceed ? (
          <>
            <Button onClick={onContinue} disabled={busy} className="flex-1 sm:flex-none">
              {busy ? "Processing…" : "Continue to OCR"}
              {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="md" onClick={onRetake} disabled={busy}>
              Use a different image
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onRetake} className="flex-1 sm:flex-none">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retake Image
          </Button>
        )}
      </div>
    </Card>
  );
}
