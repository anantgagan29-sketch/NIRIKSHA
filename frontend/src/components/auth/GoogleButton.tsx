import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { googleSignInAvailable } from "@/services/supabase";

/** Google's mark, drawn rather than fetched so it needs no network. */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.3C2.8 17 2 20.4 2 24s.8 7 2.3 10l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4 30 2 24 2 15.4 2 7.9 6.9 4.3 14l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}

/**
 * The Google sign-in control.
 *
 * It starts a real OAuth round trip: the click hands the browser to Google,
 * and the session is established when it returns. There is no local success
 * state to fake, because nothing here decides whether the sign-in worked.
 */
export function GoogleButton({
  onClick,
  busy,
  disabled,
  label = "Continue with Google",
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  // Null while the project is still being asked. The button is shown in a
  // waiting state rather than hidden, so it does not appear and then vanish
  // under the pointer.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    void googleSignInAvailable().then((value) => {
      if (!cancelled) setAvailable(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const offered = available !== false;

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onClick}
        disabled={busy || disabled || !offered || available === null}
        aria-describedby={offered ? undefined : "google-unavailable"}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GoogleMark />}
        {busy ? "Taking you to Google…" : label}
      </Button>

      {/* Said here rather than by sending someone to a JSON error page. */}
      {!offered && (
        <p id="google-unavailable" className="mt-2 text-center text-[12px] leading-relaxed text-muted">
          Google sign-in is not switched on for this project yet. Use your email and password
          below.
        </p>
      )}
    </div>
  );
}
