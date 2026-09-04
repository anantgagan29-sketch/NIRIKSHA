import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { SwitchRow } from "@/components/ui/Switch";
import { useAccessibility, type TextSize } from "@/hooks/useAccessibility";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES } from "@/i18n/languages";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ButtonLink } from "@/components/ui/Button";
import { API_BASE_URL, FORCE_CLIENT_PIPELINE, USING_MOCK_DATA } from "@/services/config";
import { HAS_BACKEND, checkHealth } from "@/services/nirikshaApi";
import { useAsync } from "@/hooks/useAsync";
import { cn } from "@/lib/cn";

export function Settings() {
  const { textSize, setTextSize, highContrast, toggleContrast, reduceMotion, toggleMotion } =
    useAccessibility();
  const { language, setLanguage, t } = useLanguage();
  const { user, usingRealAccounts } = useAuth();
  const { theme, setTheme, followingSystem } = useTheme();
  const health = useAsync(checkHealth, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="mt-7 flex flex-col gap-5">
        <Card>
          <CardHeader title={t("settings.language")} />
          <CardBody className="flex flex-col gap-4">
            <Field
              label="Interface language"
              hint="Translating the interface does not change how well a recognition engine reads Devanagari on a package — those are different problems, and this control only affects the interface."
              htmlFor="language"
            >
              {/* Driven by the same registry as the header selector, so the
                  two controls can never disagree about what is available.
                  Languages without a dictionary are listed but disabled —
                  the same honesty the header panel shows. */}
              <Select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code} disabled={!option.supported}>
                    {option.native}
                    {option.native === option.english ? "" : ` (${option.english})`}
                    {option.supported ? "" : ` — ${t("language.comingSoon")}`}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.appearance")} />
          <CardBody className="flex flex-col gap-4">
            <Field label="Theme" htmlFor="theme" hint={followingSystem ? "Currently following your system setting." : undefined}>
              <Select
                id="theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value as "light" | "dark")}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.accessibility")} />
          <CardBody className="flex flex-col gap-4">
            <Field label="Text size" htmlFor="textsize">
              <Select
                id="textsize"
                value={textSize}
                onChange={(event) => setTextSize(event.target.value as TextSize)}
              >
                <option value="base">Default</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra large</option>
              </Select>
            </Field>

            <SwitchRow
              label="High contrast"
              hint="Strengthens borders and darkens secondary text."
              checked={highContrast}
              onChange={toggleContrast}
              className="border border-line px-4 py-3"
            />
            <SwitchRow
              label="Reduce motion"
              hint="Disables animation, and replaces the 3D scene with a static figure."
              checked={reduceMotion}
              onChange={toggleMotion}
              className="border border-line px-4 py-3"
            />

            <p className="text-[12.5px] leading-relaxed text-muted">
              Assessment results can also be read aloud from the result screen, using your
              browser&rsquo;s own speech synthesis.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.account")} />
          {user ? (
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name">
                <Input id="name" defaultValue={user.name} />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" defaultValue={user.email} readOnly />
              </Field>
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wider text-faint">Account type</p>
                <p className="mt-1 text-[13.5px] font-medium text-ink">
                  {user.role === "authority" ? "Authority account" : "Citizen account"}
                </p>
              </div>
              {/* The claim has to match reality: with a project configured the
                  account is real, and without one it is this browser's own. */}
              <p className="text-[12.5px] leading-relaxed text-muted sm:col-span-2">
                {usingRealAccounts
                  ? "Your account is held by the authentication service, and your session carries across devices. Editing these fields here does not save yet."
                  : "No authentication service is configured, so accounts in this build live in this browser only. They are for development and are not a security boundary."}
              </p>
            </CardBody>
          ) : (
            <CardBody className="flex flex-col items-start gap-3.5">
              <p className="text-[13.5px] leading-relaxed text-muted">
                You are not signed in. An account keeps your scans, reports and complaints
                together — inspecting a product does not require one.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <ButtonLink to="/login" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" size="sm" variant="secondary">
                  Create an account
                </ButtonLink>
              </div>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title={t("settings.dataSource")} />
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-canvas px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">
                  {USING_MOCK_DATA ? "Local demonstration data" : "NIRIKSHA API"}
                </p>
                <p className="mt-0.5 break-all text-[12px] text-muted">
                  {USING_MOCK_DATA
                    ? "No API is configured, so products, scans and complaints come from local fixtures."
                    : API_BASE_URL}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  USING_MOCK_DATA
                    ? "border-review/25 bg-review-bg text-review"
                    : health.loading
                      ? "border-line bg-canvas text-muted"
                      : health.data
                        ? "border-pass/25 bg-pass-bg text-pass"
                        : "border-fail/25 bg-fail-bg text-fail",
                )}
              >
                {USING_MOCK_DATA
                  ? "Demo"
                  : health.loading
                    ? "Checking…"
                    : health.data
                      ? "Connected"
                      : "Unreachable"}
              </span>
            </div>

            {!USING_MOCK_DATA && !health.loading && !health.data && (
              <p className="rounded-lg border border-fail/25 bg-fail-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                The API did not answer. Start the backend, or clear
                <code className="mx-1 font-mono text-[11.5px]">VITE_API_BASE_URL</code>
                to fall back to local data.
              </p>
            )}

            <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-ink">Recognition and compliance:</span>{" "}
                {HAS_BACKEND
                  ? "run on the server, which reads the label with a vision model and applies the rule engine."
                  : FORCE_CLIENT_PIPELINE
                    ? "forced to run in this browser, even though an API is configured."
                    : "run in this browser using the local engine."}
              </p>
              <p>
                <span className="font-medium text-ink">Scan history and complaints:</span>{" "}
                {USING_MOCK_DATA
                  ? "local fixtures — nothing is stored."
                  : "stored by the API and shared across everyone using it."}
              </p>
              <p>
                <span className="font-medium text-ink">Accounts:</span> held in this browser only.
                The API has no authentication yet, so signing in does not protect anything on the
                server.
              </p>
            </div>
          </CardBody>
        </Card>

        <AssessmentNotice />
      </div>
    </div>
  );
}
