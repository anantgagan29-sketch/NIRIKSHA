import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { homeFor, takePendingRole, useAuth } from "@/hooks/useAuth";

/**
 * Where Google returns to.
 *
 * The Supabase client reads the session out of the returned URL on its own,
 * so there is nothing to exchange here. What this screen does is wait for that
 * to finish, write the role the person chose before they left, and send them
 * on — and say plainly what happened if any of it did not work, rather than
 * dropping someone back on the sign-in form with no explanation.
 *
 * A cancelled sign-in returns here too, with the reason in the query string.
 * That is not an error to hide: it is the answer to a question the person was
 * asked, and it belongs on screen.
 */
export function AuthCallback() {
  const { user, ready, applyRole } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // The role is written once. Without this the effect's re-runs would keep
  // re-issuing the same update as the session settles.
  const applied = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Google reports a refusal or a failure in the query string rather than by
  // failing to return at all.
  const refused = params.get("error_description") ?? params.get("error");

  useEffect(() => {
    if (refused || !ready || applied.current) return;

    if (!user) {
      // Ready, returned, and still nobody signed in: the round trip did not
      // produce a session.
      setError("Sign-in did not complete. Please try again.");
      return;
    }

    applied.current = true;
    const pending = takePendingRole();

    // The role is recorded against the account, so it survives this tab, this
    // browser and every later visit. An account that already carries a role
    // keeps it: signing in again is not a request to change what you are.
    const finish = async () => {
      let role = user.role;

      try {
        if (pending && pending !== role) {
          await applyRole(pending);
          role = pending;
        }
      } catch {
        // A role that could not be written is not worth blocking entry over;
        // the account keeps the role it had, and lands accordingly.
      }

      navigate(homeFor(role), { replace: true });
    };

    void finish();
  }, [ready, user, refused, applyRole, navigate]);

  const message = refused
    ? "Sign-in was cancelled, or Google did not approve it. Nothing has changed on your account."
    : error;

  if (message) {
    return (
      <AuthLayout title="Sign-in did not complete" subtitle="You can try again from the sign-in screen.">
        <div className="flex flex-col gap-5">
          <AuthError message={message} />
          <Button onClick={() => navigate("/login", { replace: true })}>Back to sign in</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in" subtitle="Finishing up with Google.">
      <p className="text-sm text-muted">One moment…</p>
    </AuthLayout>
  );
}
