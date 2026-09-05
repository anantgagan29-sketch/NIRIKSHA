import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase connection, and the one place that decides whether there is one.
 *
 * The anon key belongs in the frontend: it is designed to be public, and what
 * it can reach is decided by row-level security on the server, not by keeping
 * the string secret. The service-role key is the opposite — it bypasses those
 * rules entirely — and must never appear in anything shipped to a browser.
 *
 * When no project is configured the application still runs, on the local
 * account store it used before. That keeps the build working for anyone who
 * checks it out without credentials, and means a missing key is a clear
 * message rather than a blank screen.
 */

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** True when a project is configured and accounts are real. */
export const HAS_SUPABASE = Boolean(url && anonKey);

/**
 * A guard against the mistake that matters. The service-role key starts the
 * same way as the anon key, so it is easy to paste in by accident — and it
 * would hand every visitor full access to the database.
 */
const SECRET_KEY_REFUSED =
  "VITE_SUPABASE_ANON_KEY holds a secret key. That key bypasses row-level security " +
  "and must never be shipped to a browser. Use the publishable (anon) key instead.";

if (HAS_SUPABASE) {
  // Newer projects issue `sb_publishable_…` and `sb_secret_…`; older ones issue
  // JWTs whose payload names the role. Both shapes are checked, because the
  // pair sit next to each other in the dashboard and the wrong one is one
  // mis-click away.
  if (anonKey.startsWith("sb_secret_")) {
    throw new Error(SECRET_KEY_REFUSED);
  }

  if (anonKey.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(anonKey.split(".")[1] ?? ""));
      if (payload?.role === "service_role") throw new Error(SECRET_KEY_REFUSED);
    } catch (cause) {
      // A key that will not decode is not proof of anything; only a positively
      // identified secret key stops the application starting.
      if (cause instanceof Error && cause.message === SECRET_KEY_REFUSED) throw cause;
    }
  }
}

export const supabase: SupabaseClient | null = HAS_SUPABASE
  ? createClient(url, anonKey, {
      auth: {
        // The session is kept and refreshed by the library, so a reload does
        // not sign someone out mid-inspection.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;


/**
 * Whether Google sign-in is switched on for this project.
 *
 * Supabase publishes which providers a project accepts, so the application can
 * ask before it sends anyone anywhere. Without this, pressing the button
 * handed the browser to Supabase, which answered a raw JSON error — a person
 * looking for a Google login instead got `{"code":400,...}` on a blank page,
 * with no way back and nothing explaining what went wrong.
 *
 * Enabling the provider is a change to the project, not to this code. When it
 * is made, this starts returning true and the button works — nothing here
 * needs redeploying.
 */
let googleAvailable: Promise<boolean> | null = null;

export function googleSignInAvailable(): Promise<boolean> {
  if (!HAS_SUPABASE) return Promise.resolve(false);

  // Asked once per page load; the answer does not change while someone is
  // looking at a sign-in form.
  googleAvailable ??= fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } })
    .then((response) => (response.ok ? response.json() : null))
    .then((settings) => Boolean(settings?.external?.google))
    .catch(() => false);

  return googleAvailable;
}
