import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-brand-600">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/**
 * The qualification that must appear wherever an outcome is shown. Kept in one
 * component so the claim cannot drift toward "certified" as the product grows.
 */
export function AssessmentNotice({ variant = "default", className }: { variant?: "default" | "complaint" | "inline"; className?: string }) {
  const { t } = useLanguage();
  // The complaint wording has no translation yet, so it stays in English
  // rather than being paraphrased: it is a legal statement.
  const text =
    variant === "complaint"
      ? "Submitting this records the complaint in the NIRIKSHA system. NIRIKSHA is not connected to any government complaint portal, and submission here does not by itself constitute a filing with a statutory authority."
      : t("notice.assessment");

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-faint", className)}>Automated assessment. Not a statutory determination.</p>
    );
  }

  return (
    <p className={cn("rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-xs leading-relaxed text-muted", className)}>
      {text}
    </p>
  );
}
