import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, AlertTriangle } from "lucide-react";

type ToastTone = "success" | "info" | "warning";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<(tone: ToastTone, message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const ICONS = { success: Check, info: Info, warning: AlertTriangle };
const TONES = {
  success: "border-pass/30 bg-pass-bg text-pass",
  info: "border-brand-200 bg-brand-50 text-brand-700",
  warning: "border-review/30 bg-review-bg text-review",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 shadow-lg ${TONES[toast.tone]}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-ink">{toast.message}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
