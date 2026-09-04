import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Reveals its children as they scroll into view.
 *
 * Only opacity and a small vertical offset are animated, so nothing reflows
 * and no layout shift is introduced. It fires once — content that re-animates
 * every time it re-enters the viewport is distracting on a long page.
 *
 * Under reduced motion the children render in their resting state immediately,
 * never animated faster.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Component = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduced = useReducedMotion();
  const Motion = motion[Component];

  if (reduced) return <Component className={className}>{children}</Component>;

  return (
    <Motion
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Motion>
  );
}
