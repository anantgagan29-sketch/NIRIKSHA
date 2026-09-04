import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A side drawer used for evidence panels, and a centred modal for
 * confirmations. Both trap Escape, lock scroll, and are labelled for screen
 * readers.
 */
function Shell({
  open,
  onClose,
  title,
  children,
  side,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-console-deep/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={side ? { x: 40, opacity: 0 } : { y: 16, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: 40, opacity: 0 } : { y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn(
              "relative z-10 flex flex-col bg-surface shadow-2xl",
              side
                ? "ml-auto h-full w-full max-w-[30rem] border-l border-line"
                : "m-auto w-full max-w-lg rounded-[var(--radius-card)] border border-line",
              className,
            )}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer(props: Omit<React.ComponentProps<typeof Shell>, "side">) {
  return <Shell {...props} side />;
}

export function Modal(props: Omit<React.ComponentProps<typeof Shell>, "side">) {
  return <Shell {...props} side={false} />;
}
