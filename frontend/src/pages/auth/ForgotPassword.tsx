import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Info } from "lucide-react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Step = "identify" | "choose" | "done";

/**
 * Password reset.
 *
 * A real system emails a single-use, time-limited link and never lets the
 * browser decide who may reset which account. This build has no mail server,
 * so it verifies the address locally and lets the owner of this browser set a
 * new password — with a notice saying exactly that, rather than pretending an
 * email was sent.
 */
export function ForgotPassword() {
  const { accountExists, resetPassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function identify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!accountExists(email)) {
      setError("No account was found for that email address.");
      return;
    }
    setStep("choose");
  }

  async function choose(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
      return setError("Use at least 8 characters, with one letter and one number.");
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    setBusy(true);
    try {
      await resetPassword(email, password);
      setStep("done");
      toast("success", "Password updated. You can sign in now.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={step === "done" ? "Password updated" : "Reset your password"}
      subtitle={
        step === "identify"
          ? "Confirm the email address on your account to continue."
          : step === "choose"
            ? "Choose a new password for this account."
            : "You can sign in with your new password."
      }
      footer={
        step !== "done" && (
          <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        )
      }
    >
      {/* Progress across the two steps, so the flow is legible. */}
      {step !== "done" && (
        <ol className="mb-6 flex items-center gap-2" aria-label="Reset progress">
          {["Confirm email", "New password"].map((label, index) => {
            const active = (step === "identify" && index === 0) || (step === "choose" && index === 1);
            const done = step === "choose" && index === 0;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    done
                      ? "bg-brand-500 text-white"
                      : active
                        ? "border border-brand-400 bg-brand-50 text-brand-700"
                        : "border border-line text-faint",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn("text-[12.5px]", active || done ? "text-ink" : "text-faint")}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {step === "identify" && (
        <form onSubmit={identify} className="flex flex-col gap-5">
          <Field label="Email address" required htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.in"
            />
          </Field>

          <div className="flex gap-2.5 rounded-lg border border-line bg-canvas px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-[12px] leading-relaxed text-muted">
              This build has no mail server, so no email is sent. A production system would
              email a single-use link that expires, and would never confirm in the browser
              whether an address has an account.
            </p>
          </div>

          <AuthError message={error} />

          <Button type="submit" size="lg">
            Continue
          </Button>
        </form>
      )}

      {step === "choose" && (
        <form onSubmit={choose} className="flex flex-col gap-5">
          <div className="rounded-lg border border-line bg-canvas px-3.5 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-faint">Account</p>
            <p className="mt-0.5 text-[13.5px] font-medium text-ink">{email}</p>
          </div>

          <Field label="New password" required htmlFor="password" hint="At least 8 characters, with one letter and one number.">
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="Confirm new password" required htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          <AuthError message={error} />

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}

      {step === "done" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-lg border border-pass/25 bg-pass-bg px-4 py-3.5">
            <Check className="h-5 w-5 shrink-0 text-pass" aria-hidden="true" />
            <p className="text-[13.5px] text-ink">
              The password for <span className="font-medium">{email}</span> has been changed.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
