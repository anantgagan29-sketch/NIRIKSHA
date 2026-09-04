import { useEffect } from "react";

/**
 * A soft ring that trails the pointer.
 *
 * The native cursor is deliberately left visible. Hiding it in favour of a
 * drawn one costs precision and breaks affordances people rely on — text
 * carets, resize handles, the system's own high-visibility cursor settings —
 * a poor trade in a tool meant for inspection work.
 *
 * The element is created and driven outside React: it is pure decoration, it
 * must never re-render the app on pointer movement, and keeping it out of the
 * tree removes any question of mount timing. Movement is smoothed by a CSS
 * transition rather than a manual animation loop, so the browser owns the
 * easing and nothing runs when the pointer is still.
 */
const RING_ID = "niriksha-cursor-ring";
const INTERACTIVE = 'a, button, [role="button"], [role="switch"], input, select, textarea, label';

export function CursorGlow() {
  useEffect(() => {
    // Skip on touch devices and wherever motion is unwanted.
    const fine = window.matchMedia("(pointer: fine)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let ring: HTMLDivElement | null = null;

    const teardown = () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      ring?.remove();
      ring = null;
    };

    function onMove(event: PointerEvent) {
      if (!ring) return;
      const over = (event.target as Element | null)?.closest?.(INTERACTIVE);
      ring.style.opacity = "1";
      ring.style.transform =
        `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%) scale(${over ? 1.85 : 1})`;
    }

    function onLeave() {
      if (ring) ring.style.opacity = "0";
    }

    const setup = () => {
      const wanted =
        fine.matches && !motion.matches && !document.documentElement.classList.contains("a11y-reduce-motion");

      if (!wanted) return teardown();
      if (ring) return;

      ring = document.createElement("div");
      ring.id = RING_ID;
      ring.setAttribute("aria-hidden", "true");
      Object.assign(ring.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "36px",
        height: "36px",
        borderRadius: "9999px",
        border: "1.5px solid color-mix(in oklab, var(--color-brand-500) 55%, transparent)",
        background:
          "radial-gradient(circle, color-mix(in oklab, var(--color-brand-500) 12%, transparent) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: "150",
        opacity: "0",
        willChange: "transform, opacity",
        transition: "transform 140ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease",
      } satisfies Partial<CSSStyleDeclaration>);

      document.body.appendChild(ring);
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    };

    setup();

    fine.addEventListener("change", setup);
    motion.addEventListener("change", setup);
    // The accessibility menu toggles a class on <html>.
    const observer = new MutationObserver(setup);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      fine.removeEventListener("change", setup);
      motion.removeEventListener("change", setup);
      observer.disconnect();
      teardown();
    };
  }, []);

  return null;
}
