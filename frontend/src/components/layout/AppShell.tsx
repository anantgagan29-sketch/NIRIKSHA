import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AssessmentNotice } from "@/components/ui/PageHeader";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />

        <main id="main" className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-line bg-surface px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              <span className="font-display font-semibold tracking-wide text-ink">NIRIKSHA</span>
              <span className="mx-2 text-faint">·</span>
              Smart Compliance. Safer India.
            </p>
            {/* The assessment qualification is rendered by each result screen,
                so repeating it here would stack the same paragraph twice. */}
            <AssessmentNotice variant="inline" />
          </div>
        </footer>
      </div>
    </div>
  );
}
