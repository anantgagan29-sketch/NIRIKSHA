import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useSceneCapability } from "./useSceneCapability";
import { cn } from "@/lib/cn";

/**
 * The hero visual and its stand-in.
 *
 * The scene is code-split and only loaded once the device is known to support
 * it and the visitor has not asked for reduced motion. Everyone else gets the
 * static figure, which carries the same meaning: a package, a scanning pass,
 * and the declarations being read.
 */
const ProductScene = lazy(() => import("./ProductScene"));

/** The declarations the scanner calls out, positioned around the product. */
const CALLOUTS = [
  { label: "MRP", sub: "(Incl. of all taxes)", side: "left", top: "16%" },
  { label: "NET QUANTITY", side: "left", top: "34%" },
  { label: "MANUFACTURER", side: "left", top: "52%" },
  { label: "CONSUMER CARE", sub: "1800-123-4567", side: "right", top: "24%" },
  { label: "COUNTRY OF ORIGIN", sub: "INDIA", side: "right", top: "46%" },
] as const;

export function HeroVisual({ className }: { className?: string }) {
  const { enabled, compact } = useSceneCapability();

  return (
    <div className={cn("relative", className)}>
      <div className="relative h-[22rem] w-full sm:h-[26rem] lg:h-[30rem]">
        {enabled === true ? (
          <Suspense fallback={<StaticProduct />}>
            <ProductScene compact={compact} />
          </Suspense>
        ) : (
          <StaticProduct />
        )}

        {/* Declaration callouts sit in HTML, not in the scene: crisper text,
            and they stay readable to a screen reader and at any text size. */}
        <ul className="pointer-events-none absolute inset-0 hidden xl:block">
          {CALLOUTS.map((callout, index) => (
            <motion.li
              key={callout.label}
              initial={{ opacity: 0, x: callout.side === "left" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.11, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ top: callout.top }}
              className={cn(
                "absolute rounded-lg border border-line bg-surface/95 px-3 py-1.5 shadow-sm backdrop-blur",
                callout.side === "left" ? "left-0" : "right-0",
              )}
            >
              <p className="font-mono text-[10.5px] font-medium tracking-wide text-ink">{callout.label}</p>
              {"sub" in callout && callout.sub && (
                <p className="font-mono text-[10px] text-muted">{callout.sub}</p>
              )}
            </motion.li>
          ))}
        </ul>
      </div>

      <InspectionReady />
    </div>
  );
}

function InspectionReady() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mx-auto -mt-2 flex max-w-xs flex-col items-center gap-2 text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal text-white shadow-lg shadow-brand-600/25"
      >
        <ShieldCheck className="h-7 w-7" />
      </span>
      <p className="font-display text-sm font-bold tracking-wide text-ink">AI INSPECTION READY</p>
      <p className="text-[11.5px] leading-relaxed text-muted">
        Computer Vision · OCR · Rule Engine
        <br />
        Compliance Verification
      </p>
    </motion.div>
  );
}

/** No WebGL, or reduced motion: same story, no animation. */
function StaticProduct() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 320 340" className="h-full w-auto max-w-full">
        <defs>
          <linearGradient id="nk-band" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1f7a45" />
            <stop offset="100%" stopColor="#0e8f84" />
          </linearGradient>
        </defs>

        <ellipse cx="160" cy="306" rx="78" ry="10" fill="#0f1a14" opacity="0.07" />
        <rect x="94" y="46" width="132" height="248" rx="12" fill="#e9efe9" stroke="#cfdad3" />
        <rect x="103" y="55" width="114" height="230" rx="7" fill="#f7f5ef" />
        <rect x="103" y="55" width="114" height="62" rx="7" fill="url(#nk-band)" />

        <rect x="113" y="132" width="94" height="13" rx="3" fill="#2b8a52" opacity="0.16" />
        <rect x="113" y="132" width="94" height="13" rx="3" fill="none" stroke="#0e8f84" strokeWidth="1" />
        <rect x="113" y="164" width="72" height="13" rx="3" fill="#2b8a52" opacity="0.16" />
        <rect x="113" y="164" width="72" height="13" rx="3" fill="none" stroke="#0e8f84" strokeWidth="1" />
        <rect x="113" y="196" width="86" height="13" rx="3" fill="#2b8a52" opacity="0.16" />
        <rect x="113" y="196" width="86" height="13" rx="3" fill="none" stroke="#0e8f84" strokeWidth="1" />
        <rect x="113" y="228" width="58" height="13" rx="3" fill="#2b8a52" opacity="0.16" />
        <rect x="113" y="228" width="58" height="13" rx="3" fill="none" stroke="#0e8f84" strokeWidth="1" />

        <rect x="74" y="176" width="172" height="3" rx="1.5" fill="#2b8a52" opacity="0.85" />
        <circle cx="66" cy="96" r="3" fill="#0e8f84" opacity="0.55" />
        <circle cx="256" cy="128" r="2.5" fill="#0e8f84" opacity="0.4" />
        <circle cx="60" cy="232" r="2" fill="#2b8a52" opacity="0.45" />
        <circle cx="262" cy="238" r="3" fill="#2b8a52" opacity="0.35" />
      </svg>
    </div>
  );
}
