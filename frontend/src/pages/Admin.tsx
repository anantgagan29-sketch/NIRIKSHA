import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, FileText, ShieldCheck } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { ComplaintTimeline } from "@/components/ui/Timeline";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { listComplaints, updateComplaintStatus } from "@/services/inspectionService";
import { DEMO_PRODUCTS } from "@/data/demoProducts";
import type { Complaint, ComplaintStatus } from "@/data/types";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

const PILL: Record<ComplaintStatus, { tone: "pass" | "fail" | "review" | "neutral"; label: string }> = {
  submitted: { tone: "neutral", label: "Submitted" },
  under_review: { tone: "review", label: "Under Review" },
  verified: { tone: "pass", label: "Verified" },
  action_taken: { tone: "pass", label: "Action Taken" },
  rejected: { tone: "fail", label: "Rejected" },
};

/** Which moves are offered from each state, so an invalid one is never shown. */
const NEXT: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["verified", "rejected"],
  verified: ["action_taken", "rejected"],
  action_taken: [],
  rejected: ["under_review"],
};

export function Admin() {
  const { t } = useLanguage();
  const queue = useAsync(listComplaints, []);
  const [active, setActive] = useState<Complaint | null>(null);
  const toast = useToast();

  const complaints = queue.data ?? [];

  const counts = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "submitted").length,
    review: complaints.filter((c) => c.status === "under_review").length,
    verified: complaints.filter((c) => c.status === "verified").length,
    action: complaints.filter((c) => c.status === "action_taken").length,
  };

  /**
   * Moves a complaint on. The server owns the transition rules, so an invalid
   * move comes back as a refusal rather than being applied optimistically.
   */
  async function move(complaint: Complaint, status: ComplaintStatus) {
    try {
      const updated = await updateComplaintStatus(
        complaint.id,
        status,
        `Status changed to ${PILL[status].label.toLowerCase()} by the reviewing account.`,
      );

      // The mock path returns only an acknowledgement; the API returns the
      // updated record. Refreshing the queue covers both.
      if (updated && "timeline" in updated) setActive(updated as Complaint);
      queue.reload();

      toast("success", `${complaint.id} marked ${PILL[status].label.toLowerCase()}.`);
    } catch (cause) {
      toast("warning", cause instanceof Error ? cause.message : "The update was refused.");
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("admin.eyebrow")}
        title={t("admin.title")}
        description="Citizen complaints with the assessment findings and label evidence attached, for triage by a reviewing account."
        actions={
          <span className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[12.5px] font-medium text-brand-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Inspector view
          </span>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total Reports" value={counts.total} tone="text-ink" />
        <Stat label="Pending" value={counts.pending} tone="text-muted" />
        <Stat label="Under Review" value={counts.review} tone="text-review" />
        <Stat label="Verified" value={counts.verified} tone="text-pass" />
        <Stat label="Action Taken" value={counts.action} tone="text-brand-700" />
      </div>

      <Card className="mt-5">
        <CardHeader
          title={t("admin.queue")}
          action={
            <span className="text-[11.5px] text-muted">
              {queue.loading ? "Loading…" : `${complaints.length} complaints`}
            </span>
          }
        />
        <CardBody className="p-0">
          {queue.loading ? (
            <LoadingState label="Loading the complaint queue…" />
          ) : queue.error ? (
            <ErrorState message={queue.error} onRetry={queue.reload} />
          ) : complaints.length === 0 ? (
            <EmptyState
              title={t("complaints.empty")}
              body="Complaints filed against an assessment appear here for review, with the label evidence and findings attached."
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-semibold">Complaint ID</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Violation</th>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr
                    key={complaint.id}
                    onClick={() => setActive(complaint)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] text-brand-700">{complaint.id}</td>
                    <td className="px-5 py-3.5 text-[13.5px] text-ink">{complaint.product}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-muted">{complaint.violationType}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-muted">{complaint.location}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-muted">
                      {new Date(complaint.filedOn).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill {...PILL[complaint.status]} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardBody>
      </Card>

      <AssessmentNotice variant="complaint" className="mt-5" />

      <Drawer open={Boolean(active)} onClose={() => setActive(null)} title={t("admin.review")}>
        {active && <Review complaint={active} onMove={move} />}
      </Drawer>
    </div>
  );
}

function Review({
  complaint,
  onMove,
}: {
  complaint: Complaint;
  onMove: (complaint: Complaint, status: ComplaintStatus) => void | Promise<void>;
}) {
  const product = DEMO_PRODUCTS.find((item) => item.scanId === complaint.scanId) ?? DEMO_PRODUCTS[1];
  const failures = product.checks.filter((check) => check.status === "fail");
  const moves = NEXT[complaint.status];

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <p className="font-mono text-sm text-brand-700">{complaint.id}</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-ink">{complaint.product}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill {...PILL[complaint.status]} size="sm" />
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {complaint.location}
          </span>
        </div>
      </div>

      <Section title="Complaint description">{complaint.description}</Section>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Product evidence</p>
        <LabelSpecimen lines={product.labelLines} compact />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Compliance findings</p>
        <div className="flex flex-col gap-2">
          {failures.length === 0 ? (
            <p className="text-[13px] text-muted">No failed checks recorded on the attached scan.</p>
          ) : (
            failures.map((check) => (
              <div key={check.id} className="rounded-lg border border-fail/25 bg-fail-bg px-3.5 py-2.5">
                <p className="text-[12.5px] font-medium text-ink">{check.label}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{check.reason}</p>
                <p className="mt-1.5 font-mono text-[10.5px] text-muted">
                  {check.instrument} — {check.provision}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">OCR evidence</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3.5 font-mono text-[11px] leading-relaxed text-ink-2">
          {product.rawText}
        </pre>
      </div>

      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">History</p>
        <ComplaintTimeline status={complaint.status} events={complaint.timeline} />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Actions</p>
        {moves.length === 0 ? (
          <p className="text-[13px] text-muted">This complaint is closed. No further action is available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {moves.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === "rejected" ? "danger" : status === "under_review" ? "secondary" : "primary"}
                onClick={() => void onMove(complaint, status)}
              >
                {status === "verified" && <FileText className="h-4 w-4" aria-hidden="true" />}
                Mark {PILL[status].label}
              </Button>
            ))}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-faint">
          Actions here update this frontend build only. No statutory authority is notified.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</p>
      <p className="text-[13.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card px-4 py-3.5">
      <p className={cn("tnum font-display text-2xl font-bold leading-none", tone)}>{value}</p>
      <p className="mt-1.5 text-[11.5px] text-muted">{label}</p>
    </motion.div>
  );
}
