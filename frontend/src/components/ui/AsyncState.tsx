import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

/**
 * The shared loading, failure and empty states.
 *
 * Kept in one place so every screen reports the same three conditions the same
 * way — and so a failure always says what went wrong and offers a retry rather
 * than rendering an empty table that looks like "no results".
 */

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2.5 px-5 py-14 text-muted", className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-5 py-12 text-center", className)} role="alert">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-fail-bg text-fail"
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">Could not load this</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-5 py-14 text-center", className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
