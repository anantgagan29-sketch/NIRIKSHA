import { ClipboardCheck, ScanLine } from "lucide-react";

import type { Role } from "@/hooks/useAuth";

/**
 * Which of the two the person is here as.
 *
 * Asked first, and asked plainly. The two are not variations of one form —
 * they lead to different work, and one of them carries a verification step —
 * so they are two blocks to choose between rather than a control inside a
 * form somebody has already started filling in.
 */

const ROLES: {
  role: Role;
  title: string;
  description: string;
  cta: string;
  icon: typeof ScanLine;
}[] = [
  {
    role: "citizen",
    title: "User",
    description: "Inspect packaged products and check their compliance.",
    cta: "Continue as User",
    icon: ScanLine,
  },
  {
    role: "authority",
    title: "Inspector",
    description: "Conduct official inspections and review compliance reports.",
    cta: "Continue as Inspector",
    icon: ClipboardCheck,
  },
];

export function RoleChoice({ onChoose }: { onChoose: (role: Role) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {ROLES.map((option) => (
        <button
          key={option.role}
          type="button"
          onClick={() => onChoose(option.role)}
          className="group flex w-full items-start gap-4 rounded-xl border border-line-strong bg-surface p-5 text-left transition-all hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-white">
            <option.icon className="h-5 w-5" aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-ink">{option.title}</span>
            <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
              {option.description}
            </span>
            <span className="mt-3 block text-[13px] font-medium text-brand-700">
              {option.cta} →
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
