import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      toast("success", "Signed in.");
      navigate(next, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Your scans, reports and complaints, kept together."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
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

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
