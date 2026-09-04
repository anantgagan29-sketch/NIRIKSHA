import { ButtonLink } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-sm tracking-wider text-faint">404</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">This page does not exist</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        The screen you are looking for could not be found. It may have been moved, or the link may
        be incomplete.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <ButtonLink to="/inspect">Inspect a Product</ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Back to Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
