import { useEffect, useState } from "react";

/**
 * True when animation should be suppressed.
 *
 * Two sources, either of which is enough: the operating system's
 * `prefers-reduced-motion`, and the app's own Reduce Motion switch, which sets
 * a class on <html>. Decorative motion checks this and renders its resting
 * state instead — it never merely runs faster.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    const evaluate = () =>
      setReduced(query.matches || document.documentElement.classList.contains("a11y-reduce-motion"));

    evaluate();
    query.addEventListener("change", evaluate);

    // The accessibility menu toggles the class, so watch for it directly.
    const observer = new MutationObserver(evaluate);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      query.removeEventListener("change", evaluate);
      observer.disconnect();
    };
  }, []);

  return reduced;
}
