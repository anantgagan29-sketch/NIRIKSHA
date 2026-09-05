import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { homeFor, useAuth, type Role } from "@/hooks/useAuth";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { RoleChoice } from "@/components/auth/RoleChoice";
import { InspectorVerification } from "@/components/auth/InspectorVerification";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Requirements shown live, so nothing is rejected only after submitting. */
const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One letter and one number", test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
];

export function Register() {
  const { signUp, signInWithGoogle, applyRole } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);

  // Asked before the form, for the same reason the sign-in screen asks: the
  // two roles are different work, and one of them carries a further step.
  const [role, setRole] = useState<Role | null>(null);

  const met = RULES.map((rule) => rule.test(password));
  const strong = met.every(Boolean);
  const matches = confirm.length > 0 && confirm === password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!strong) return setError("Please choose a password that meets both requirements.");
    if (!matches) return setError("The two passwords do not match.");

    setBusy(true);
    try {
      await signUp(name, email, password);

      // signUp writes the default role; an inspector's choice is recorded
      // over it now that there is an account to record it against.
      if (role && role !== "citizen") {
        try {
          await applyRole(role);
        } catch {
          // The account exists and is signed in; the role can be set later.
        }
      }

      toast("success", "Account created. You are signed in.");
      navigate(homeFor(role ?? "citizen"), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account.");
      setBusy(false);
    }
  }

  async function withGoogle() {
    if (!role) return;

    setError(null);
    setGoogle(true);

    try {
      // Google is a sign-up and a sign-in in one: an account it has seen
      // before is signed in rather than duplicated.
      await signInWithGoogle(role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setGoogle(false);
    }
  }

  if (!role) {
    return (
      <AuthLayout
        title="Create an account"
        subtitle="Choose how you will be using NIRIKSHA."
        footer={
          <>
            Already registered?{" "}
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <RoleChoice onChoose={setRole} />
      </AuthLayout>
    );
  }

  const inspector = role === "authority";

  return (
    <AuthLayout
      title={inspector ? "Create an inspector account" : "Create an account"}
      subtitle="Takes a moment. Inspecting a product does not require one."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => {
            setRole(null);
            setError(null);
          }}
          className="-mt-1 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Choose a different role
        </button>

        <GoogleButton onClick={() => void withGoogle()} busy={google} label="Sign up with Google" />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[12px] font-medium uppercase tracking-wide text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
        <Field label="Full name" required htmlFor="name">
          <Input
            id="name"
            required
            minLength={2}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

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

        <Field label="Password" required htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={visible ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition-colors hover:text-ink"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <ul className="mt-2.5 flex flex-col gap-1.5">
            {RULES.map((rule, index) => (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-2 text-[12.5px]",
                  password.length === 0 ? "text-faint" : met[index] ? "text-pass" : "text-muted",
                )}
              >
                <Check
                  className={cn("h-3.5 w-3.5 shrink-0", met[index] ? "opacity-100" : "opacity-35")}
                  aria-hidden="true"
                />
                {rule.label}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Confirm password" required htmlFor="confirm">
          <Input
            id="confirm"
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm.length > 0 && !matches && (
            <p className="mt-1.5 text-[12.5px] text-fail">The two passwords do not match.</p>
          )}
        </Field>

        <AuthError message={error} />

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {inspector && (
        <div className="mt-6">
          <InspectorVerification />
        </div>
      )}
    </AuthLayout>
  );
}
