import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { homeFor, useAuth, type Role } from "@/hooks/useAuth";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { RoleChoice } from "@/components/auth/RoleChoice";
import { InspectorVerification } from "@/components/auth/InspectorVerification";
import { useToast } from "@/components/ui/Toast";

export function Login() {
  const { signIn, signInWithGoogle, applyRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);

  // Which of the two the person said they are. Null until they choose, which
  // is what puts the role blocks in front of the form rather than beside it.
  const [role, setRole] = useState<Role | null>(null);

  const next = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);

      // The choice made on the previous screen is recorded against the
      // account, so it is there on the next visit and after a refresh.
      // An account that already carries this role is left alone.
      if (role) {
        try {
          await applyRole(role);
        } catch (cause) {
          // Signed in, but not as what they chose. Saying so is the only way
          // the next screen makes sense: without the role the inspector
          // console is closed to them and they land on the user dashboard.
          setError(
            (cause instanceof Error ? cause.message : "The role could not be saved.") +
              " You are signed in, but not yet as an inspector.",
          );
          setBusy(false);
          return;
        }
      }

      toast("success", "Signed in.");

      // A caller that asked for a particular page gets it; otherwise the
      // role decides, so an inspector opens on their queue.
      navigate(next === "/" && role ? homeFor(role) : next, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
      setBusy(false);
    }
  }

  async function withGoogle() {
    if (!role) return;

    setError(null);
    setGoogle(true);

    try {
      // Hands the browser to Google. Nothing after this line runs on success:
      // the page is replaced, and the session is picked up at /auth/callback.
      await signInWithGoogle(role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setGoogle(false);
    }
  }

  /* ---------------------------------------------------------- role first */

  if (!role) {
    return (
      <AuthLayout
        title="Sign in"
        subtitle="Choose how you are using NIRIKSHA."
        footer={
          <>
            New here?{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Create an account
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
      title={inspector ? "Inspector sign-in" : "User sign-in"}
      subtitle={
        inspector
          ? "Conduct official inspections and review compliance reports."
          : "Your scans, reports and complaints, kept together."
      }
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Create an account
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

        <GoogleButton onClick={() => void withGoogle()} busy={google} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[12px] font-medium uppercase tracking-wide text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
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
              autoComplete="current-password"
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
        </Field>

        <div className="-mt-2 flex justify-end">
          <Link to="/forgot-password" className="text-[13px] font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>

        <AuthError message={error} />

        <Button type="submit" size="lg" disabled={busy || google}>
          {busy ? "Signing in…" : "Sign in"}
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
