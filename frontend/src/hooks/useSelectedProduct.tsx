import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEMO_PRODUCTS } from "@/data/demoProducts";
import type { DemoProduct } from "@/data/types";

/**
 * Which product the result screens are currently showing.
 *
 * The routes in this build are flat (/scan-result, /compliance) rather than
 * parameterised, so the selection is held here and shared across them. When a
 * backend arrives this becomes a scan id in the URL and this hook goes away.
 */
interface SelectedValue {
  product: DemoProduct;
  select: (id: string) => void;
  options: DemoProduct[];
  /** Publishes the outcome of a live scan so the result screens can show it. */
  registerLive: (product: DemoProduct) => void;
}

const STORAGE_KEY = "niriksha.selected";
const SelectedContext = createContext<SelectedValue | null>(null);

export function SelectedProductProvider({ children }: { children: React.ReactNode }) {
  // Live scans are held in memory only: they carry an object URL that does not
  // survive a reload, and they are not demonstration fixtures.
  const [live, setLive] = useState<DemoProduct | null>(null);
  const [id, setId] = useState<string>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored && DEMO_PRODUCTS.some((p) => p.id === stored) ? stored : DEMO_PRODUCTS[1].id;
    } catch {
      return DEMO_PRODUCTS[1].id;
    }
  });

  const select = useCallback((next: string) => {
    setId(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A selection that cannot be saved still applies for this visit.
    }
  }, []);

  const registerLive = useCallback((product: DemoProduct) => {
    setLive(product);
    setId(product.id);
  }, []);

  const value = useMemo<SelectedValue>(() => {
    const options = live ? [live, ...DEMO_PRODUCTS] : DEMO_PRODUCTS;
    return {
      product: options.find((p) => p.id === id) ?? options[0],
      select,
      options,
      registerLive,
    };
  }, [id, live, select, registerLive]);

  return <SelectedContext.Provider value={value}>{children}</SelectedContext.Provider>;
}

export function useSelectedProduct(): SelectedValue {
  const value = useContext(SelectedContext);
  if (!value) throw new Error("useSelectedProduct must be used inside <SelectedProductProvider>.");
  return value;
}
