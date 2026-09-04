import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Upload, CheckCircle2 } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { StatusPill } from "@/components/ui/StatusPill";
import { ComplaintTimeline } from "@/components/ui/Timeline";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { useSelectedProduct } from "@/hooks/useSelectedProduct";
import { useToast } from "@/components/ui/Toast";
import { listComplaints, submitComplaint } from "@/services/inspectionService";
import { VIOLATION_TYPES } from "@/data/complaints";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import type { Complaint } from "@/data/types";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

const STATUS_PILL = {
  submitted: { tone: "neutral" as const, label: "Submitted" },
  under_review: { tone: "review" as const, label: "Under Review" },
  verified: { tone: "pass" as const, label: "Verified" },
  action_taken: { tone: "pass" as const, label: "Action Taken" },
  rejected: { tone: "fail" as const, label: "Rejected" },
};

export function Complaints() {
  const { t } = useLanguage();
  const { product, options, select } = useSelectedProduct();
  const toast = useToast();
  const complaints = useAsync(listComplaints, []);

  const [submitted, setSubmitted] = useState<Complaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [violation, setViolation] = useState(VIOLATION_TYPES[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);

  function captureLocation() {
    if (!navigator.geolocation) {
      toast("warning", "This browser cannot provide a location. You can type one instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Rounded deliberately: enough to identify a locality, not a doorstep.
        setLocation(
          `${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)} (approximate)`,
        );
        setLocating(false);
        toast("success", "Approximate location attached, rounded to about a hundred metres.");
      },
      () => {
        setLocating(false);
        toast("info", "Location access was declined. The complaint works without it.");
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    let complaint;
    try {
      complaint = await submitComplaint({
        productId: product.id,
        scanId: product.scanId,
        productName: product.name,
        violationType: violation,
        description,
        location,
      });
    } catch (cause) {
      setBusy(false);
      toast(
        "warning",
        cause instanceof Error ? cause.message : "The complaint could not be submitted.",
      );
      return;
    }
    setSubmitted(complaint);
    setBusy(false);
    toast("success", `Complaint ${complaint.id} recorded in the NIRIKSHA system.`);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 18 }}
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-pass-bg text-pass"
              >
                <CheckCircle2 className="h-9 w-9" />
              </motion.span>

              <div>
                <h2 className="font-display text-xl font-bold text-ink">Complaint Submitted</h2>
                <p className="mt-1.5 text-sm text-muted">
                  Keep this reference. You can return to check its status at any time.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-canvas px-6 py-4">
                <p className="text-[11px] uppercase tracking-wider text-faint">Complaint ID</p>
                <p className="mt-1 font-mono text-xl font-semibold text-ink">{submitted.id}</p>
              </div>

              <StatusPill {...STATUS_PILL[submitted.status]} />
            </CardBody>

            <div className="border-t border-line px-6 py-6">
              <h3 className="mb-4 font-display text-sm font-semibold text-ink">Tracking</h3>
              <ComplaintTimeline status={submitted.status} events={submitted.timeline} />
            </div>

            <div className="border-t border-line px-6 py-5">
              <AssessmentNotice variant="complaint" />
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button variant="secondary" onClick={() => setSubmitted(null)}>
                  File another complaint
                </Button>
                <ButtonLink to="/history" variant="ghost">
                  Back to scan history
                </ButtonLink>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("complaints.eyebrow")}
        title={t("complaints.reportTitle")}
        description={t("complaints.reportDescription")}
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader title={t("complaints.details")} />
          <CardBody>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <Field label="Product" required htmlFor="product">
                <Select
                  id="product"
                  value={product.id}
                  onChange={(event) => select(event.target.value)}
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {option.scanId}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Violation type" required htmlFor="violation">
                <Select id="violation" value={violation} onChange={(e) => setViolation(e.target.value)}>
                  {VIOLATION_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Description"
                required
                htmlFor="description"
                hint="Describe what you saw on the package and where you bought it."
              >
                <Textarea
                  id="description"
                  required
                  minLength={20}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="For example: the pack shows a price but does not state that it is inclusive of all taxes. Bought at a shop in…"
                />
              </Field>

              <Field label="Evidence image" hint="The scanned label is attached automatically.">
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-canvas px-4 py-3">
                  <Upload className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                    {product.scanId} — {product.name}
                  </span>
                  <StatusPill tone="pass" label="Attached" size="sm" />
                </div>
              </Field>

              <Field label="Location" hint="Optional. Rounded to roughly a hundred metres." htmlFor="location">
                <div className="flex gap-2">
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Area, city"
                  />
                  <Button type="button" variant="secondary" onClick={captureLocation} disabled={locating}>
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {locating ? "Locating…" : "Use my location"}
                  </Button>
                </div>
              </Field>

              <Field label="Additional information" htmlFor="additional">
                <Textarea id="additional" rows={3} placeholder="Anything else a reviewer should know." />
              </Field>

              <AssessmentNotice variant="complaint" />

              <Button type="submit" size="lg" disabled={busy || description.trim().length < 20}>
                {busy ? "Submitting…" : "Submit Complaint"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title={t("complaints.findingsAttached")} />
            <CardBody className="flex flex-col gap-3.5">
              <Specimen product={product} compact />
              {product.checks
                .filter((check) => check.status === "fail")
                .map((check) => (
                  <div key={check.id} className="rounded-lg border border-fail/25 bg-fail-bg px-3.5 py-2.5">
                    <p className="text-[12.5px] font-medium text-ink">{check.label}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{check.reason}</p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-muted">{check.provision}</p>
                  </div>
                ))}
              {product.checks.every((check) => check.status !== "fail") && (
                <p className="text-[12.5px] leading-relaxed text-muted">
                  This assessment found no failed checks. You can still raise a complaint, and the
                  full findings will be attached.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("complaints.recent")} />
            <CardBody className="p-0">
              {complaints.loading ? (
                <LoadingState label="Loading complaints…" />
              ) : complaints.error ? (
                <ErrorState message={complaints.error} onRetry={complaints.reload} />
              ) : (complaints.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title={t("complaints.none")}
                  body="When an assessment finds a potential issue, raising it here creates a reference you can track."
                />
              ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {(complaints.data ?? []).map((complaint) => (
                  <li key={complaint.id} className={cn("px-5 py-3.5")}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[12.5px] text-ink">{complaint.id}</p>
                      <StatusPill {...STATUS_PILL[complaint.status]} size="sm" />
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-muted">{complaint.product}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{complaint.violationType}</p>
                  </li>
                ))}
              </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Specimen({
  product,
  highlight,
  compact,
}: {
  product: { labelLines: string[]; imageUrl?: string };
  highlight?: string;
  compact?: boolean;
}) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt="The label that was inspected"
        className="mx-auto max-h-[26rem] w-auto max-w-full rounded-md border border-line object-contain"
      />
    );
  }
  return <LabelSpecimen lines={product.labelLines} highlight={highlight} compact={compact} />;
}
