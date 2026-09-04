import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { StatusPill, resultPill } from "@/components/ui/StatusPill";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { listScans, getScanStats } from "@/services/inspectionService";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ComplianceResult } from "@/data/types";
import { getScan } from "@/services/nirikshaApi";
import { downloadComplianceReport } from "@/services/reportPdf";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/hooks/useLanguage";

const RANGES = { all: "All time", week: "Last 7 days", month: "Last 30 days" } as const;

export function History() {
  const { t } = useLanguage();
  const scans = useAsync(listScans, []);
  const stats = useAsync(getScanStats, []);

  const toast = useToast();
  const [building, setBuilding] = useState<string | null>(null);

  /**
   * Fetches one stored scan and turns it into a report.
   *
   * The row itself carries only a summary, so the full assessment is loaded
   * first — a report built from the summary alone would be missing the very
   * reasoning it exists to record.
   */
  async function downloadFor(scanId: string) {
    setBuilding(scanId);

    try {
      const outcome = await getScan(scanId);

      await downloadComplianceReport({
        id: `scan-${scanId}`,
        scanId,
        name: outcome.productName ?? "Recorded scan",
        category: "Recorded scan",
        netQuantity: outcome.netQuantity ?? "—",
        labelLines: [],
        result: outcome.result ?? "needs_review",
        score: outcome.score,
        quality: outcome.quality,
        fields: outcome.fields,
        checks: outcome.checks,
        rawText: outcome.rawText ?? "",
        ocrConfidence: 0,
        scannedAt: new Date().toISOString(),
      });

      toast("success", `Report for ${scanId} downloaded.`);
    } catch (cause) {
      toast("warning", cause instanceof Error ? cause.message : "That report could not be built.");
    } finally {
      setBuilding(null);
    }
  }

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ComplianceResult | "all">("all");
  const [range, setRange] = useState<keyof typeof RANGES>("all");

  const rows = useMemo(() => {
    const all = scans.data ?? [];
    const cutoff =
      range === "week"
        ? Date.now() - 7 * 864e5
        : range === "month"
          ? Date.now() - 30 * 864e5
          : 0;

    return all.filter((scan) => {
      const matchesQuery =
        !query ||
        scan.product.toLowerCase().includes(query.toLowerCase()) ||
        scan.scanId.toLowerCase().includes(query.toLowerCase()) ||
        scan.category.toLowerCase().includes(query.toLowerCase());
      const matchesResult = result === "all" || scan.result === result;
      const matchesRange = !cutoff || new Date(scan.date).getTime() >= cutoff;
      return matchesQuery && matchesResult && matchesRange;
    });
  }, [scans.data, query, result, range]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
        description={t("history.description")}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Products Inspected" value={stats.data?.inspected} tone="text-ink" loading={stats.loading} />
        <Stat label="Compliant" value={stats.data?.compliant} tone="text-pass" loading={stats.loading} />
        <Stat label="Non-Compliant" value={stats.data?.nonCompliant} tone="text-fail" loading={stats.loading} />
        <Stat label="Needs Review" value={stats.data?.needsReview} tone="text-review" loading={stats.loading} />
      </div>

      <Reveal delay={0.06} className="mt-5 block">
      <Card>
        <CardHeader
          title={t("history.scans")}
          action={
            <span className="text-[11.5px] text-muted">
              {scans.loading ? "Loading…" : `${rows.length} shown`}
            </span>
          }
        />

        <CardBody className="border-b border-line">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full min-w-0 sm:min-w-[14rem] sm:flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search product, category or scan ID"
                aria-label="Search scans"
                className="pl-10"
              />
            </div>

            {/* The filter group wraps and its controls shrink, so a narrow
                phone never forces the page to scroll sideways. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SlidersHorizontal className="hidden h-4 w-4 shrink-0 text-faint sm:block" aria-hidden="true" />
              <Select
                value={result}
                onChange={(event) => setResult(event.target.value as ComplianceResult | "all")}
                aria-label="Filter by result"
                className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              >
                <option value="all">All results</option>
                <option value="compliant">Compliant</option>
                <option value="non_compliant">Non-Compliant</option>
                <option value="needs_review">Needs Review</option>
              </Select>

              <Select
                value={range}
                onChange={(event) => setRange(event.target.value as keyof typeof RANGES)}
                aria-label="Filter by date"
                className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              >
                {Object.entries(RANGES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardBody>

        <CardBody className="p-0">
          {scans.loading ? (
            <LoadingState label="Loading your scans…" />
          ) : scans.error ? (
            <ErrorState message={scans.error} onRetry={scans.reload} />
          ) : (scans.data?.length ?? 0) === 0 ? (
            <EmptyState
              title={t("history.empty")}
              body="Inspect a product and it will appear here with its assessment outcome and reference."
              action={
                <ButtonLink to="/inspect" size="sm" className="mt-1">
                  Inspect a Product
                </ButtonLink>
              }
            />
          ) : rows.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted">
              No scans match those filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-5 py-3 font-semibold">Result</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Scan ID</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((scan) => (
                    <tr key={scan.scanId} className="border-b border-line last:border-0 hover:bg-canvas">
                      <td className="px-5 py-3.5">
                        <p className="text-[13.5px] font-medium text-ink">{scan.product}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">{scan.category}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill {...resultPill(scan.result)} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-muted">{scan.relative}</td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-muted">{scan.scanId}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/compliance/${encodeURIComponent(scan.scanId)}`}
                            className="text-[12.5px] font-medium text-brand-700 hover:underline"
                          >
                            View
                          </Link>
                          {/* The report is built from the stored scan, so it
                              can be taken away without opening it first. */}
                          <button
                            type="button"
                            disabled={building === scan.scanId}
                            onClick={() => downloadFor(scan.scanId)}
                            className="text-[12.5px] font-medium text-brand-700 hover:underline disabled:opacity-50"
                          >
                            {building === scan.scanId ? "Preparing…" : "PDF"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      </Reveal>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value?: number;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className="card px-4 py-3.5">
      <p className={cn("tnum font-display text-2xl font-bold leading-none", tone)}>
        {loading || value === undefined ? <span className="text-faint">—</span> : value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-muted">{label}</p>
    </div>
  );
}
