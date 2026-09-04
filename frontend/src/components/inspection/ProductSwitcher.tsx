import { StatusPill, resultPill } from "@/components/ui/StatusPill";
import { useSelectedProduct } from "@/hooks/useSelectedProduct";
import { cn } from "@/lib/cn";

/**
 * Switches which demonstration scan the result screens are showing.
 *
 * Present only because this build has no backend and no scan ids in the URL —
 * it is a scaffold for the demo, and it is labelled as one.
 */
export function ProductSwitcher({ className }: { className?: string }) {
  const { product, select, options } = useSelectedProduct();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Scan
      </span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => select(option.id)}
          aria-pressed={product.id === option.id}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
            product.id === option.id
              ? "border-brand-400 bg-brand-50 font-medium text-brand-700"
              : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
          )}
        >
          {option.isLive ? `${option.name} (live)` : option.name}
          <StatusPill {...resultPill(option.result)} size="sm" className="!px-1.5 !py-0" />
        </button>
      ))}
    </div>
  );
}
