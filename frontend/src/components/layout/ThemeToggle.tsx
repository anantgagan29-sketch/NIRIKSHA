import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

/**
 * A single small control: sun in dark mode, moon in light mode — the icon
 * shows what pressing it will do, which is the convention people expect.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      <motion.span
        key={theme}
        initial={{ rotate: -35, opacity: 0, scale: 0.85 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="block"
      >
        {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </motion.span>
    </button>
  );
}
