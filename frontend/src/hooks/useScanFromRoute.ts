import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import type { DemoProduct } from "@/data/types";
import { HAS_BACKEND, getScan, scanImageUrl } from "@/services/nirikshaApi";
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
    // Revoked when this effect is torn down: an object URL holds the whole
    // image in memory until it is given back.
    let objectUrl: string | null = null;
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

        // The photograph belongs to this scan and is fetched by its
        // reference, so opening an older report shows the packet that report
        // is about — not whichever image happens to be in memory.
        void scanImageUrl(scanId).then((url) => {
          if (cancelled) {
            if (url) URL.revokeObjectURL(url);
            return;
          }

          if (!url) return;

          objectUrl = url;
          setFetched((current) => (current ? { ...current, imageUrl: url } : current));
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scanId]);

  return { product: fetched ?? selected, loading, error };
}
