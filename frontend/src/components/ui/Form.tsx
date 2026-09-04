import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-fail">
            *
          </span>
        )}
      </label>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(CONTROL, "h-11 pr-9", className)} {...props} />;
}
