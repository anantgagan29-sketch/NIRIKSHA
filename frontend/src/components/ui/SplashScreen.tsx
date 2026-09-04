import { useEffect, useState } from "react";
import markLight from "@/assets/niriksha-mark-light.png";

/**
 * The opening title card.
 *
 * Shown once per page load, not on every navigation — a splash a user cannot
 * get past is a toll booth, not a brand moment. The app mounts underneath
 * while it plays, so nothing waits on it, and the overlay never takes pointer
 * events.
 *
 * "Per page load" is the whole of the rule. It played once per *tab* before,
 * because the decision was stored in sessionStorage, which survives a refresh —
 * so reloading the page skipped the opening entirely. The decision now lives in
 * module scope, which is exactly the lifetime wanted: a fresh document parses
 * the module again and the splash plays, while moving between routes does not
 * re-run it and so cannot make the splash reappear mid-session.
 *
 * The name is written out a letter at a time behind a caret, so the opening
 * reads as the product introducing itself rather than a logo being stamped on
 * the screen.
 *
 * The fade out is a plain CSS transition on a state class, not an animation
 * library exit: an overlay that covers the entire application must not be able
 * to get stuck up if an animation fails to report completion. Everything
 * inside it is free to be animated, because failing there costs nothing.
 */
const LETTERS = "NIRIKSHA".split("");

/** Letter cadence, and the point at which the whole word has landed. */
const WRITE_START = 0.42;
const WRITE_STEP = 0.085;
const WRITE_END = WRITE_START + WRITE_STEP * LETTERS.length;
const HOLD_MS = 2250;
const FADE_MS = 500;

/**
 * Whether this load should show the splash — read synchronously so a
 * suppressed splash never paints even one frame.
 */
function shouldShow(): boolean {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;

  // The class the accessibility provider sets is applied in an effect, which
  // has not run yet, so read the stored preference at its source.
  if (document.documentElement.classList.contains("a11y-reduce-motion")) return false;
  try {
    const stored = window.localStorage.getItem("niriksha.a11y");
    if (stored && JSON.parse(stored)?.reduceMotion === true) return false;
  } catch {
    // An unreadable preference is not a reason to suppress the splash.
  }

  return true;
}

/**
 * Decided once, at module load, before React renders.
 *
 * Deliberately not a `useState` initializer: those run twice under React's
 * development double-invoke, and the two passes must not be able to reach
 * different answers.
 */
const SHOW_SPLASH = shouldShow();

type Phase = "holding" | "fading" | "gone";

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(SHOW_SPLASH ? "holding" : "gone");

  // Neither timer carries a "run once" guard. React's development double-invoke
  // cancels the first timer in cleanup, and a guard would stop the second run
  // from creating its replacement — leaving the overlay up for good.
  useEffect(() => {
    if (phase !== "holding") return;
    const timer = window.setTimeout(() => setPhase("fading"), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`console-texture pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center bg-console transition-opacity duration-500 ease-out ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* The mark arrives first, as the anchor the name is written against. */}
      <img
        src={markLight}
        alt=""
        draggable={false}
        className="nk-pop h-[clamp(4.5rem,13vw,9rem)] w-auto select-none"
      />

      {/* The name, written a letter at a time. */}
      <h1
        aria-label="NIRIKSHA"
        className="mt-7 flex items-center font-display text-[clamp(2rem,8.5vw,5.5rem)] font-bold leading-none tracking-[0.16em] text-white sm:tracking-[0.26em]"
      >
        {LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            aria-hidden="true"
            className="nk-rise"
            style={{ animationDelay: `${WRITE_START + index * WRITE_STEP}s` }}
          >
            {letter}
          </span>
        ))}

        {/* The caret keeps pace with the writing, then steps aside. */}
        <span
          aria-hidden="true"
          className="nk-caret ml-1 inline-block h-[1.05em] w-[0.06em] bg-brand-400"
          style={{ animationDuration: `${WRITE_END + 0.5}s` }}
        />
      </h1>

      {/* A single hairline sweep, echoing the scanning pass in the product. */}
      <div className="mt-7 w-[min(78vw,34rem)]">
        <span
          aria-hidden="true"
          className="nk-sweep block h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent"
          style={{ animationDelay: `${WRITE_END}s` }}
        />
      </div>

      <p
        className="nk-rise mt-5 text-[clamp(0.7rem,1.9vw,0.95rem)] tracking-[0.22em] text-white/55"
        style={{ animationDelay: `${WRITE_END + 0.12}s`, animationDuration: "450ms" }}
      >
        SMART COMPLIANCE. SAFER INDIA.
      </p>

    </div>
  );
}
