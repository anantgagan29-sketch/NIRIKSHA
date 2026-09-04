/**
 * Runtime configuration for the data layer.
 *
 * This is the switch between local demonstration data and the NIRIKSHA API.
 * Nothing else in the app reads these values — components go through the
 * service layer, and the service layer goes through here.
 */

/** Empty means "no backend configured": the app runs on local fixtures. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** True when no API is configured, so the interface can say so honestly. */
export const USING_MOCK_DATA = API_BASE_URL.length === 0;

/**
 * Forces the in-browser pipeline even when an API is configured.
 *
 * The browser engine (Tesseract plus the local rule pack under `src/engine`)
 * stays in the build as a genuine fallback: it works with no server, on a bad
 * connection, and while the API is down. Off by default — when a backend is
 * configured, the backend does the reading.
 */
export const FORCE_CLIENT_PIPELINE =
  (import.meta.env.VITE_FORCE_CLIENT_PIPELINE ?? "false") === "true";

/** Builds an absolute API URL. Throws if called with no backend configured. */
export function apiUrl(path: string): string {
  if (USING_MOCK_DATA) {
    throw new Error(
      "No API is configured. Set VITE_API_BASE_URL in .env.local, or keep using the mock service layer.",
    );
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
