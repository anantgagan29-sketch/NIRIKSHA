import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff } from "lucide-react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Requirements shown live, so nothing is rejected only after submitting. */
const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One letter and one number", test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
];

export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      toast("success", "Account created. You are signed in.");
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create an account"
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
      <form onSubmit={submit} className="flex flex-col gap-5">
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
    </AuthLayout>
  );
}
