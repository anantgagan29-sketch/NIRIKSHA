import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import type { DemoProduct } from "@/data/types";
import { HAS_BACKEND, getScan } from "@/services/nirikshaApi";
import { useSelectedProduct } from "./useSelectedProduct";

/**
 * Which scan the result screens should show.
 *
 * The result routes accept an optional scan id. With one, that stored scan is
 * fetched and shown — which is what makes History's "View" open the scan the
 * person actually clicked, rather than whatever happened to be selected.
 * Without one, the behaviour is unchanged: the current selection is shown.
 *
 * A scan that cannot be loaded falls back to the selection rather than
 * emptying the screen, and says so, because showing a different product under
 * the requested scan's number would be worse than saying it is unavailable.
 */
export function useScanFromRoute(): {
  product: DemoProduct;
  loading: boolean;
  error: string | null;
} {
  const { scanId } = useParams<{ scanId?: string }>();
  const { product: selected } = useSelectedProduct();

  const [fetched, setFetched] = useState<DemoProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId || !HAS_BACKEND) {
      setFetched(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getScan(scanId)
      .then((outcome) => {
        if (cancelled) return;

        setFetched({
          id: `scan-${scanId}`,
          scanId,
          name: outcome.productName ?? "Recorded scan",
          category: "Recorded scan",
          netQuantity: outcome.netQuantity ?? "—",
          // A stored scan keeps no image: the upload is not retained beyond
          // the inspection, so the result screens draw their label panel
          // instead of showing a photograph that is not there.
          labelLines: [],
          isLive: true,
          result: outcome.result ?? "needs_review",
          score: outcome.score,
          quality: outcome.quality,
          fields: outcome.fields,
          checks: outcome.checks,
          rawText: outcome.rawText ?? "",
          ocrConfidence: 0,
          scannedAt: outcome.raw.created_at ?? new Date().toISOString(),
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "That scan could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanId]);

  return { product: fetched ?? selected, loading, error };
}
