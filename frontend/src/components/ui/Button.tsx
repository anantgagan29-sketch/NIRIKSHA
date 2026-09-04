import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_1px_2px_rgb(15_26_20/0.14)] font-semibold",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-brand-50 hover:border-brand-300 font-medium",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium",
  ghost: "text-muted hover:text-ink hover:bg-brand-50 font-medium",
  danger: "bg-fail text-white hover:brightness-110 font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

function classes(variant: Variant, size: Size, className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { variant?: Variant; size?: Size }
>(({ variant = "primary", size = "md", className, ...props }, ref) => (
  <button ref={ref} className={classes(variant, size, className)} {...props} />
));
Button.displayName = "Button";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={classes(variant, size, className)} {...props} />;
}
