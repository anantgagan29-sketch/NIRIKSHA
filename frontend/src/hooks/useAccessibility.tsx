import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Viewer accessibility preferences.
 *
 * Applied as classes on <html> so every surface — including anything rendered
 * into a portal — inherits them, and persisted so a preference survives
 * navigation and reloads.
 */

export type TextSize = "base" | "large" | "xlarge";

interface A11yState {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
}

interface A11yValue extends A11yState {
  setTextSize: (size: TextSize) => void;
  toggleContrast: () => void;
  toggleMotion: () => void;
  /** Reads text aloud with the browser's speech synthesis, when available. */
  speak: (text: string) => void;
  speaking: boolean;
  speechSupported: boolean;
}

const STORAGE_KEY = "niriksha.a11y";
const DEFAULTS: A11yState = { textSize: "base", highContrast: false, reduceMotion: false };

const A11yContext = createContext<A11yValue | null>(null);

function read(): A11yState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<A11yState>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<A11yState>(read);
  const [speaking, setSpeaking] = useState(false);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("a11y-text-lg", state.textSize === "large");
    root.classList.toggle("a11y-text-xl", state.textSize === "xlarge");
    root.classList.toggle("a11y-contrast", state.highContrast);
    root.classList.toggle("a11y-reduce-motion", state.reduceMotion);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // A preference that cannot be saved still applies for this visit.
    }
  }, [state]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported) return;
      const synthesis = window.speechSynthesis;

      if (synthesis.speaking) {
        synthesis.cancel();
        setSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 0.98;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synthesis.speak(utterance);
    },
    [speechSupported],
  );

  const value = useMemo<A11yValue>(
    () => ({
      ...state,
      setTextSize: (textSize) => setState((s) => ({ ...s, textSize })),
      toggleContrast: () => setState((s) => ({ ...s, highContrast: !s.highContrast })),
      toggleMotion: () => setState((s) => ({ ...s, reduceMotion: !s.reduceMotion })),
      speak,
      speaking,
      speechSupported,
    }),
    [state, speak, speaking, speechSupported],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useAccessibility(): A11yValue {
  const value = useContext(A11yContext);
  if (!value) throw new Error("useAccessibility must be used inside <AccessibilityProvider>.");
  return value;
}
