import { StatusPill } from "@/components/ui/StatusPill";
import type { LetterHeightAssessment, LetterHeightStatus } from "@/data/types";

/**
 * Rule 7 — the size of letters and numerals.
 *
 * Shown as its own section because it answers a different question from the
 * checks above it. Those ask whether a declaration is on the package. This
 * asks whether it is printed large enough to be lawful, which is a fact about
 * millimetres on cardboard: a photograph does not carry it unless something
 * in the frame establishes scale, and nothing here pretends otherwise.
 *
 * The panel leads with the requirement, because that is the part an inspector
 * standing in an aisle cannot look up — the applicable minimum depends on the
 * package's own net quantity, and the table that decides it is not something
 * anyone recalls from memory.
 */

const PILL: Record<LetterHeightStatus, { tone: "pass" | "fail" | "review" | "neutral"; label: string }> = {
  pass: { tone: "pass", label: "Pass" },
  fail: { tone: "fail", label: "Fail" },
  review: { tone: "review", label: "Review" },
  not_applicable: { tone: "neutral", label: "Not applicable" },
};

export function LetterHeightPanel({ assessment }: { assessment: LetterHeightAssessment }) {
  return (
    <section aria-labelledby="letter-height-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="letter-height-heading" className="font-display text-sm font-semibold text-ink">
          Font / lettering compliance
        </h3>
        <StatusPill {...PILL[assessment.overall]} size="sm" />
      </div>

      <p className="mt-1 text-[11.5px] text-muted">{assessment.provision}</p>

      {/* The applicable minimum, and how it was arrived at. */}
      <div className="mt-3 rounded-lg border border-line bg-canvas px-4 py-3">
        <p className="text-[12.5px] font-medium text-ink">
          {assessment.requirement.determined && assessment.requirement.minimumHeightMm !== null
            ? `Applicable minimum: ${assessment.requirement.minimumHeightMm} mm`
            : "Applicable minimum: not determined"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          {assessment.requirement.basis}
        </p>
      </div>

      {/* Why almost everything below says "review". */}
      {!assessment.scale.available && (
        <p className="mt-3 rounded-lg border border-review/25 bg-review-bg px-4 py-3 text-[11.5px] leading-relaxed text-ink-2">
          {assessment.scale.note}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {assessment.findings.map((finding) => (
          <li key={finding.field} className="rounded-lg border border-line px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ink">{finding.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-faint">
                  Evidence {finding.evidenceConfidence}
                </span>
                <StatusPill {...PILL[finding.status]} size="sm" />
              </div>
            </div>

            <dl className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed">
              <div>
                <dt className="inline font-medium text-ink-2">Required: </dt>
                <dd className="inline text-muted">{finding.requirement}</dd>
              </div>

              {finding.observed && (
                <div>
                  <dt className="inline font-medium text-ink-2">Observed: </dt>
                  <dd className="inline text-muted">{finding.observed}</dd>
                </div>
              )}

              <div>
                <dt className="inline font-medium text-ink-2">Character height: </dt>
                <dd className="inline text-muted">
                  {finding.characterHeightMm !== null
                    ? `approximately ${finding.characterHeightMm} mm`
                    : "could not be verified from the photograph"}
                </dd>
              </div>

              <div>
                <dt className="inline font-medium text-ink-2">Finding: </dt>
                <dd className="inline text-muted">{finding.finding}</dd>
              </div>

              {/* Named for what it is, so it is never read as a compliance
                  figure: it says how well the value was read, nothing more. */}
              {finding.ocrConfidence !== null && (
                <div>
                  <dt className="inline font-medium text-ink-2">Text recognition confidence: </dt>
                  <dd className="inline text-muted">
                    {Math.round(finding.ocrConfidence * 100)}% — this is reading confidence, not a
                    measure of lettering compliance
                  </dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{assessment.widthRule}</p>
    </section>
  );
}
