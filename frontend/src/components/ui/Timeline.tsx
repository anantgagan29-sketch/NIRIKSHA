import { cn } from "@/lib/cn";
import type { ComplaintEvent, ComplaintStatus } from "@/data/types";

export const COMPLAINT_STEPS: { status: ComplaintStatus; label: string; blurb: string }[] = [
  { status: "submitted", label: "Submitted", blurb: "Recorded in the NIRIKSHA system and waiting to be picked up." },
  { status: "under_review", label: "Under Review", blurb: "A reviewing account is checking the attached evidence." },
  { status: "verified", label: "Verified", blurb: "The reported issue was confirmed against the evidence." },
  { status: "action_taken", label: "Action Taken", blurb: "The reviewer recorded an outcome for this complaint." },
];

export function ComplaintTimeline({
  status,
  events,
  className,
}: {
  status: ComplaintStatus;
  events?: ComplaintEvent[];
  className?: string;
}) {
  const reached = new Set(events?.map((event) => event.status) ?? [status]);
  const currentIndex = COMPLAINT_STEPS.findIndex((step) => step.status === status);

  return (
    <ol className={cn("flex flex-col", className)}>
      {COMPLAINT_STEPS.map((step, index) => {
        const done = reached.has(step.status) || index < currentIndex;
        const current = step.status === status;
        const event = events?.find((e) => e.status === step.status);

        return (
          <li key={step.status} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4",
                  done ? "bg-brand-500 ring-brand-100" : current ? "bg-review ring-review-bg" : "bg-line-strong ring-canvas",
                )}
              />
              {index < COMPLAINT_STEPS.length - 1 && (
                <span aria-hidden="true" className={cn("my-1 w-px flex-1", done ? "bg-brand-300" : "bg-line")} />
              )}
            </div>

            <div className={cn("pb-5", index === COMPLAINT_STEPS.length - 1 && "pb-0")}>
              <p className={cn("text-sm font-medium", done || current ? "text-ink" : "text-faint")}>{step.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{event?.note ?? step.blurb}</p>
              {event && <p className="mt-1 font-mono text-[10.5px] text-faint">{event.at}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
