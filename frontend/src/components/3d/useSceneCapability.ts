import { useEffect, useState } from "react";

/**
 * Whether this visitor should get the animated scene.
 *
 * Three independent reasons to say no, each an ordinary condition rather than
 * an error: the platform reports a preference for reduced motion, the device
 * has no working WebGL context, or the viewport is small enough that the cost
 * outweighs the value. The page is complete without the scene in every case.
 */
export interface SceneCapability {
  /** Null while undetermined, so nothing renders on a guess. */
  enabled: boolean | null;
  compact: boolean;
  reason: "reduced-motion" | "no-webgl" | null;
}

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useSceneCapability(): SceneCapability {
  const [state, setState] = useState<SceneCapability>({ enabled: null, compact: false, reason: null });

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 900px)");
    const webgl = hasWebGl();

    const evaluate = () => {
      const reducedByClass = document.documentElement.classList.contains("a11y-reduce-motion");
      const reduced = motion.matches || reducedByClass;
      setState({
        enabled: webgl && !reduced,
        compact: compact.matches,
        reason: !webgl ? "no-webgl" : reduced ? "reduced-motion" : null,
      });
    };

    evaluate();
    motion.addEventListener("change", evaluate);
    compact.addEventListener("change", evaluate);

    // The accessibility menu toggles a class on <html>, so watch for it.
    const observer = new MutationObserver(evaluate);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      motion.removeEventListener("change", evaluate);
      compact.removeEventListener("change", evaluate);
      observer.disconnect();
    };
  }, []);

  return state;
}
