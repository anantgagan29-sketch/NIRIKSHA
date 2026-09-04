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
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keeps a slow first request from overwriting a newer one that already won.
  const generation = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);

    load()
      .then((result) => {
        if (generation.current !== current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (generation.current !== current) return;
        setError(cause instanceof Error ? cause.message : "Could not load this data.");
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    // `load` is expected to be stable or captured by the caller's deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
