import { BadgeCheck, Clock } from "lucide-react";

import { Field, Input } from "@/components/ui/Form";

/**
 * Government ID verification — the interface, ahead of the checking.
 *
 * Nothing here verifies anything, and the panel says so where a reader will
 * see it rather than in small print underneath. It is disabled rather than
 * merely inert: a field that accepts an ID number and then does nothing with
 * it implies a check that is not happening, and an inspector who believes
 * they are verified when they are not is worse off than one who knows they
 * are not.
 *
 * It does not gate anything. An inspector signs in and works; this is the
 * shape of a step that will exist later.
 */
export function InspectorVerification() {
  return (
    <section
      aria-labelledby="gov-id-heading"
      className="rounded-xl border border-line-strong bg-canvas p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <BadgeCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 id="gov-id-heading" className="text-[14.5px] font-semibold text-ink">
            Government ID verification
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Official inspector credentials will be checked here. Verification is not active yet,
            and nothing entered below is submitted or stored.
          </p>

          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-review-bg px-2.5 py-1 text-[12px] font-medium text-review">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Available in a future release
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 opacity-60">
        <Field label="Government ID type" htmlFor="gov-id-type">
          <Input id="gov-id-type" disabled placeholder="Legal Metrology inspector ID" />
        </Field>

        <Field label="Government ID number" htmlFor="gov-id-number">
          <Input id="gov-id-number" disabled placeholder="Not accepted yet" />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Supporting document</span>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-line-strong px-4 py-6 text-[13px] text-muted">
            Upload will open when verification is enabled
          </div>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] text-muted">
        Status: <span className="font-medium text-ink">Not verified</span> — inspector access does
        not depend on this step today.
      </p>
    </section>
  );
}
