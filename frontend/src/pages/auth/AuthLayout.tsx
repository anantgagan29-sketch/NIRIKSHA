import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/layout/Brand";

/**
 * The shell every account screen sits in.
 *
 * A split layout on desktop — brand and reassurance on the left, the form on
 * the right — collapsing to the form alone on a phone, where the marketing
 * half would only push the inputs below the fold.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand side */}
      <aside className="console-texture relative hidden flex-col justify-between bg-console p-10 lg:flex xl:p-14">
        <Link to="/">
          <BrandLockup onDark className="max-w-[13rem]" />
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
            Check a label. See the rule behind every finding.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            An account keeps your scans, reports and complaints together, and gives
            authority reviewers their own queue.
          </p>

          <ul className="mt-8 flex flex-col gap-3.5">
            {[
              "Every check cites the provision it comes from",
              "Low-confidence readings are flagged, never treated as failures",
              "Requirements that do not apply are marked, not counted against a product",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-[13.5px] leading-relaxed text-white/70">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] leading-relaxed text-white/35">
          Automated compliance assessment. Not a statutory determination, and not a
          government certification.
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 block lg:hidden">
            <BrandLockup className="max-w-[10rem]" />
          </Link>

          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}

          <p className="mt-10 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted">
            Accounts in this build are stored in your browser only. Real authentication
            belongs on the server — see <span className="font-mono">API_INTEGRATION.md</span>.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Shared error banner for the account forms. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-fail/25 bg-fail-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-fail"
    >
      {message}
    </p>
  );
}
