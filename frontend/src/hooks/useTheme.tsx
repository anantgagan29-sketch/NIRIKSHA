import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Light and dark appearance.
 *
 * The first visit follows the operating system; after that an explicit choice
 * wins and is remembered. The class goes on <html> so every surface — portals
 * and dropdowns included — inherits it, and `color-scheme` is set alongside so
 * native controls and scrollbars match.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "niriksha.theme";

interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  /** True while the theme is still whatever the system asked for. */
  followingSystem: boolean;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<Theme | null>(readStored);
  const [system, setSystem] = useState<Theme>(systemTheme);

  // Track the system preference so an unset choice keeps following it.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = stored ?? system;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A choice that cannot be saved still applies for this visit.
    }
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
      followingSystem: stored === null,
    }),
    [theme, stored, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return value;
}
