import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "@/hooks/useAuth";

/**
 * Route guard.
 *
 * Frontend guards are a courtesy for the person using the app, not a security
 * boundary — anything a browser can decide, a browser can be told to skip.
 * Enforce the same rules on every API call once a backend exists.
 */
export function RequireAuth({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  // Nothing renders until the stored session has been read, so a signed-in
  // user is never bounced to the sign-in screen on a refresh.
  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
