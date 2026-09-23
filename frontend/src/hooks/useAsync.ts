import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data from the service layer, with the three states every screen needs.
 *
 * `data` is null until the first load resolves, so a page can tell "still
 * loading" from "loaded and empty" — a distinction that matters once real
 * records are involved, where an empty list is a legitimate answer rather than
 * a sign that something failed.
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** True while a cached answer is on screen and a fresh one is on its way. */
  refreshing: boolean;
}

/**
 * The last answer each cached call returned, for this page load only.
 *
 * Kept in memory rather than in storage on purpose: this holds somebody's
 * scan history, and a list of the products a person inspected is not
 * something to leave on the disk of a shared machine. A reload therefore
 * fetches again, which is the right trade — what this removes is the
 * spinner on every visit to a screen already seen.
 */
const cache = new Map<string, unknown>();

/** Forgotten on sign-out, so one account never sees another's rows. */
export function clearAsyncCache(): void {
  cache.clear();
}

export function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
  options: { cacheKey?: string } = {},
): AsyncState<T> {
  const { cacheKey } = options;
  const cached = cacheKey ? (cache.get(cacheKey) as T | undefined) : undefined;

  // A cached answer is the initial state, so the screen has content to draw
  // on its first frame instead of a spinner followed by a layout shift.
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(cached !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keeps a slow first request from overwriting a newer one that already won.
  const generation = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const current = ++generation.current;
    const showing = cacheKey ? cache.has(cacheKey) : false;

    // With something already on screen this is a refresh, not a load: the
    // rows stay, and only the quiet indicator says more is coming.
    setLoading(!showing);
    setRefreshing(showing);
    setError(null);

    load()
      .then((result) => {
        if (cacheKey) cache.set(cacheKey, result);
        if (generation.current !== current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (generation.current !== current) return;
        // A failed refresh leaves the last answer in place rather than
        // replacing a list somebody is reading with an error.
        if (!showing) setError(cause instanceof Error ? cause.message : "Could not load this data.");
      })
      .finally(() => {
        if (generation.current !== current) return;
        setLoading(false);
        setRefreshing(false);
      });
    // `load` is expected to be stable or captured by the caller's deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload, refreshing };
}
