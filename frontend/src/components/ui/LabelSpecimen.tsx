import { cn } from "@/lib/cn";

/**
 * A drawn packaged-commodity label.
 *
 * This frontend build has no photographs, so labels are rendered from the
 * demo data rather than shipped as images. It keeps the bundle small, and it
 * means the text on screen is the same text the extraction panel reports.
 */
export function LabelSpecimen({
  lines,
  highlight,
  className,
  compact,
}: {
  lines: string[];
  /** Substring to mark, used to point at the declaration under discussion. */
  highlight?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[19rem] rounded-md border-2 border-ink/85 bg-[#FBFAF6] shadow-sm",
        compact ? "p-3.5" : "p-5",
        className,
      )}
    >
      <p
        className={cn(
          "font-display font-bold tracking-wide text-ink",
          compact ? "text-[13px]" : "text-lg",
        )}
      >
        {lines[0]}
      </p>
      <div className="my-2.5 h-px bg-line-strong" />
      <div className={cn("flex flex-col gap-1.5 font-mono text-ink-2", compact ? "text-[8.5px]" : "text-[11px]")}>
        {lines.slice(1).map((line, index) => {
          const marked = highlight && line.toLowerCase().includes(highlight.toLowerCase());
          return (
            <p key={`${line}-${index}`} className={cn("leading-snug", marked && "-mx-1 rounded bg-fail-bg px-1 text-fail")}>
              {line}
            </p>
          );
        })}
      </div>
      <div className="mt-3 h-px bg-line-strong" />
      <p className={cn("mt-2 font-mono text-faint", compact ? "text-[7px]" : "text-[9px]")}>
        NIRIKSHA specimen label — not a real product
      </p>
    </div>
  );
}
