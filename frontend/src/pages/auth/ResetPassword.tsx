import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";

import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/services/supabase";

/**
 * Where the reset email's link lands.
 *
 * Clicking that link signs the browser in with a short-lived recovery session,
 * which is the only thing that authorises setting a new password here. That is
 * why the reset had to go out by email: possession of the inbox is the proof,
 * and it is proof this page cannot fake.
 *
 * Someone arriving without that session — an expired link, or the URL typed
 * directly — is told so rather than shown a form that cannot work.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    // The client reads the recovery token out of the URL as it starts, so the
    // session may land a moment after this page mounts. Both the immediate
    // check and the event are needed: whichever happens first wins.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setAllowed(true);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        setAllowed(true);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
      return setError("Use at least 8 characters, with one letter and one number.");
    }
    if (password !== confirm) return setError("The two passwords do not match.");
    if (!supabase) return setError("Password reset is not available in this build.");

    setBusy(true);
    try {
      const { error: cause } = await supabase.auth.updateUser({ password });
      if (cause) throw new Error(cause.message);

      setDone(true);
      toast("success", "Password updated. You are signed in.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={done ? "Password updated" : "Choose a new password"}
      subtitle={
        done
          ? "You are signed in with your new password."
          : allowed
            ? "Set the password you will use from now on."
            : "This link is what authorises the change."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {checking && <p className="text-[13.5px] text-muted">Checking your reset link…</p>}

      {!checking && !allowed && (
        <div className="flex flex-col gap-5">
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13.5px] leading-relaxed text-amber-900">
            This reset link is no longer valid. Links expire after a while, and each one can only
            be used once. Request a new one and open it from the same device.
          </p>
          <Button size="lg" onClick={() => navigate("/forgot-password")}>
            Request a new link
          </Button>
        </div>
      )}

      {!checking && allowed && !done && (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Field label="New password" htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>

          {error && <p className="text-[12.5px] text-red-700">{error}</p>}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}

      {done && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-lg border border-pass/25 bg-pass-bg px-4 py-3.5">
            <Check className="h-5 w-5 shrink-0 text-pass" aria-hidden="true" />
            <p className="text-[13.5px] text-ink">Your password has been changed.</p>
          </div>
          <Button size="lg" onClick={() => navigate("/")}>
            Continue to NIRIKSHA
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
