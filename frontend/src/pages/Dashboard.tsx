import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle, Download, MapPin, FileText, ScanLine } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { StatusPill, qualityPill, resultPill, DemoBadge } from "@/components/ui/StatusPill";
import { ScoreRing, ProgressBar } from "@/components/ui/Progress";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { AssessmentNotice } from "@/components/ui/PageHeader";
import { HeroVisual } from "@/components/3d/HeroVisual";
import { Reveal } from "@/components/ui/Reveal";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/Toast";
import { DEMO_PRODUCTS } from "@/data/demoProducts";
import { useAsync } from "@/hooks/useAsync";
import { listScans, getScanStats } from "@/services/inspectionService";
import { PIPELINE_STAGES } from "@/data/pipeline";
import { cn } from "@/lib/cn";

const compliant = DEMO_PRODUCTS[0];
const nonCompliant = DEMO_PRODUCTS[1];

export function Dashboard() {
  const { t } = useLanguage();
  // The overview reflects real inspections; the four showcase cards above it
  // stay on the sample products, which exist to explain the workflow.
  const stats = useAsync(getScanStats, []);
  const scans = useAsync(listScans, []);

  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-10 sm:px-6">
      {/* ------------------------------------------------------------ hero */}
      <section className="hero-wash -mx-4 mb-8 px-4 pb-4 pt-8 sm:-mx-6 sm:px-6 lg:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl xl:text-[3.4rem]"
            >
              {t("hero.title1")}
              <br />
              <span className="text-brand-600">{t("hero.title2")}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-xl text-[16px] font-medium text-ink-2"
            >
              {t("hero.lede")}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted"
            >
              {t("hero.body")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <ButtonLink to="/inspect" size="lg">
                <ScanLine className="h-[18px] w-[18px]" aria-hidden="true" />
                {t("hero.cta")}
              </ButtonLink>
              <ButtonLink to="/how-it-works" size="lg" variant="secondary">
                <PlayCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                {t("hero.secondary")}
              </ButtonLink>
            </motion.div>

            <AssessmentNotice variant="inline" className="mt-6" />
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* -------------------------------------------------- workflow strip */}
      <Reveal as="section" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1 — upload */}
        <Card>
          <CardHeader title={t("dashboard.inspectCard")} />
          <CardBody>
            <UploadZone
              compact
              onSelect={() => {
                toast("info", "This build runs on demonstration data — opening the inspection workspace.");
                navigate("/inspect");
              }}
              onBarcode={() => {
                toast("info", "Barcode lookup resolves against the prototype product database in this build.");
                navigate("/inspect");
              }}
            />
          </CardBody>
        </Card>

        {/* 2 — quality */}
        <Card>
          <CardHeader
            title={t("dashboard.imageQuality")}
            action={<StatusPill {...qualityPill(compliant.quality.verdict)} size="sm" />}
          />
          <CardBody className="flex flex-col gap-4">
            {/* Specimen and score sit side by side; the metric list gets the
                full card width so its labels are never truncated. */}
            <div className="flex items-center gap-4">
              <LabelSpecimen
                lines={compliant.labelLines.slice(0, 7)}
                compact
                className="w-[6.5rem] shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <ScoreRing value={compliant.quality.score} size={78} tone="pass" />
                <p className="text-center text-[11px] leading-snug text-muted">
                  Measured before any text is read
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2 border-t border-line pt-3.5">
              {compliant.quality.metrics.map((metric) => (
                <li key={metric.key} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] text-ink-2">{metric.label}</span>
                  <StatusPill {...qualityPill(metric.verdict)} size="sm" />
                </li>
              ))}
            </ul>
          </CardBody>
          <div className="border-t border-line px-5 py-3">
            <ButtonLink to="/inspect" variant="subtle" size="sm" className="w-full">
              Continue to OCR
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </Card>

        {/* 3 — processing */}
        <Card>
          <CardHeader title={t("dashboard.processing")} action={<DemoBadge />} />
          <CardBody className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2.5">
              {PIPELINE_STAGES.map((stage, index) => {
                const done = index < 3;
                const active = index === 3;
                return (
                  <li key={stage.id} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        done ? "bg-pass" : active ? "animate-pulse bg-brand-500" : "bg-line-strong",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-[12.5px]",
                        done ? "text-ink" : active ? "font-medium text-brand-700" : "text-faint",
                      )}
                    >
                      {stage.title}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-muted">Extracting declarations…</span>
                <span className="tnum font-mono text-ink">65%</span>
              </div>
              <ProgressBar value={65} />
            </div>
          </CardBody>
        </Card>

        {/* 4 — compliance */}
        <Card>
          <CardHeader
            title={t("dashboard.complianceAnalysis")}
            action={
              <Link to="/compliance" className="text-[11.5px] font-medium text-brand-700 hover:underline">
                View rule evidence
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-3.5 p-0">
            <div className="mx-5 mt-5 rounded-lg bg-gradient-to-r from-pass to-brand-600 px-4 py-3 text-white">
              <p className="font-display text-[15px] font-bold tracking-wide">✓ COMPLIANT</p>
              <p className="mt-0.5 text-[11.5px] text-white/85">All applicable declarations detected.</p>
            </div>

            <ul className="divide-y divide-[var(--color-line)] border-y border-line">
              {compliant.checks.slice(0, 5).map((check) => (
                <li key={check.id} className="flex items-center gap-3 px-5 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                    {check.label.replace(" declared", "")}
                  </span>
                  <span className="hidden max-w-[6.5rem] truncate font-mono text-[11px] text-muted sm:block">
                    {check.detected ?? "—"}
                  </span>
                  <StatusPill {...(check.status === "pass" ? { tone: "pass" as const, label: "" } : { tone: "na" as const, label: "" })} size="sm" className="!px-1.5" />
                </li>
              ))}
            </ul>

            <div className="px-5 pb-5">
              <ButtonLink to="/compliance" variant="subtle" size="sm" className="w-full">
                View All Checks
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* ------------------------------------------------------ lower band */}
      <Reveal as="section" delay={0.05} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
        {/* non-compliant example */}
        <Card>
          <CardHeader title={t("dashboard.nonCompliantExample")} />
          <CardBody className="flex flex-col gap-3.5">
            <div className="rounded-lg border border-fail/25 bg-fail-bg px-4 py-3">
              <p className="font-display text-[15px] font-bold text-fail">✕ NON-COMPLIANT</p>
              <p className="mt-0.5 text-[11.5px] text-ink-2">2 potential issues detected</p>
            </div>
            <ul className="flex flex-col gap-2">
              {nonCompliant.checks
                .filter((check) => check.status === "fail" || check.status === "review")
                .map((check) => (
                  <li key={check.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] text-ink-2">
                      {check.label.replace(" declared", "")}
                    </span>
                    <StatusPill
                      tone={check.status === "fail" ? "fail" : "review"}
                      label={check.status === "fail" ? "Issue" : "Review"}
                      size="sm"
                    />
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <ButtonLink to="/compliance" variant="secondary" size="sm" className="flex-1">
                View Violations
              </ButtonLink>
              <ButtonLink to="/complaints" variant="danger" size="sm" className="flex-1">
                Report Product
              </ButtonLink>
            </div>
          </CardBody>
        </Card>

        {/* report */}
        <Card>
          <CardHeader title={t("dashboard.complianceReport")} />
          <CardBody className="flex flex-col items-center gap-3.5 text-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-line bg-canvas text-fail"
            >
              <FileText className="h-7 w-7" />
            </span>
            <p className="text-[13px] leading-relaxed text-muted">
              Generate a detailed assessment with every field check, its reason and its cited
              provision.
            </p>
            <ButtonLink to="/reports" size="sm" className="w-full">
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Report
            </ButtonLink>
          </CardBody>
        </Card>

        {/* complaint */}
        <Card>
          <CardHeader title={t("dashboard.citizenComplaint")} />
          <CardBody className="flex flex-col items-center gap-3.5 text-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-line bg-canvas text-brand-600"
            >
              <MapPin className="h-7 w-7" />
            </span>
            <p className="text-[13px] leading-relaxed text-muted">
              Raise a potential violation with the product evidence and assessment findings
              attached.
            </p>
            <ButtonLink to="/complaints" variant="secondary" size="sm" className="w-full">
              Report Violation
            </ButtonLink>
            <p className="font-mono text-[10.5px] text-faint">Latest: NIR-CMP-2026-00481</p>
          </CardBody>
        </Card>

        {/* overview */}
        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader
            title={t("dashboard.overview")}
            action={
              <Link to="/history" className="text-[11.5px] font-medium text-brand-700 hover:underline">
                View all scans
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Inspected" value={stats.data?.inspected} tone="text-ink" />
              <Stat label="Compliant" value={stats.data?.compliant} tone="text-pass" />
              <Stat label="Non-Compliant" value={stats.data?.nonCompliant} tone="text-fail" />
              <Stat label="Needs Review" value={stats.data?.needsReview} tone="text-review" />
              <Stat label="Complaints" value={stats.data?.complaints} tone="text-brand-700" />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                Recent scans
              </p>
              <ul className="divide-y divide-[var(--color-line)] rounded-lg border border-line">
                {scans.loading && (
                  <li className="px-3.5 py-4 text-[12.5px] text-muted">Loading recent scans…</li>
                )}
                {!scans.loading && (scans.data?.length ?? 0) === 0 && (
                  <li className="px-3.5 py-4 text-[12.5px] text-muted">
                    No scans yet — inspect a product to start the history.
                  </li>
                )}
                {(scans.data ?? []).slice(0, 3).map((scan) => (
                  <li key={scan.scanId} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{scan.product}</span>
                    <StatusPill {...resultPill(scan.result)} size="sm" />
                    <span className="hidden font-mono text-[11px] text-faint lg:block">{scan.scanId}</span>
                    <Link
                      to="/compliance"
                      className="shrink-0 text-[11.5px] font-medium text-brand-700 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </Reveal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
      <p className={cn("tnum font-display text-xl font-bold leading-none", tone)}>
        {value === undefined ? <span className="text-faint">—</span> : value}
      </p>
      <p className="mt-1 text-[10.5px] leading-tight text-muted">{label}</p>
    </div>
  );
}
