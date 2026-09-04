import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("card min-w-0", className)} {...props} />;
}

/**
 * Card headers carry a small brand dot, which is the console's quiet way of
 * marking every working surface as part of one system.
 */
export function CardHeader({
  title,
  action,
  className,
  ...props
}: React.ComponentProps<"header"> & { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header
      className={cn("flex items-center justify-between gap-4 border-b border-line px-5 py-3.5", className)}
      {...props}
    >
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        {title}
      </h2>
      {action}
    </header>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
