import { DownloadReportMenu } from "@/components/report/DownloadReportMenu";
import { Printer, Share2 } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill, checkPill, resultPill, DemoBadge } from "@/components/ui/StatusPill";
import { ProductSwitcher } from "@/components/inspection/ProductSwitcher";
import { useScanFromRoute } from "@/hooks/useScanFromRoute";
import { useToast } from "@/components/ui/Toast";
import { BrandLockup } from "@/components/layout/Brand";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Report preview.
 *
 * The document is composed here and printed by the browser. No PDF is
 * generated on a server in this build, and the interface does not suggest one
 * has been: the actions are a real print, a real clipboard copy, and a clearly
 * labelled placeholder for the eventual download.
 */
export function Reports() {
  const { t } = useLanguage();
  const { product } = useScanFromRoute();
  const toast = useToast();

  const assessed = new Date(product.scannedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("reports.eyebrow")}
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          <>
            <DownloadReportMenu product={product} />
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("common.print")}
            </Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/reports?scan=${product.scanId}`,
                  );
                  toast("success", "Report link copied to your clipboard.");
                } catch {
                  toast("warning", "Your browser did not allow copying to the clipboard.");
                }
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share Report
            </Button>
          </>
        }
      />

      <ProductSwitcher className="mt-5" />

      <Card className="mx-auto mt-6 max-w-4xl">
        {/* masthead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-7 py-6">
          <div className="flex flex-col gap-1.5">
            <BrandLockup className="max-w-[11rem]" />
            <p className="text-[11.5px] text-muted">Product Compliance Report</p>
          </div>
          <DemoBadge />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line px-7 py-5 sm:grid-cols-4">
          <Meta label="Scan ID" value={product.scanId} mono />
          <Meta label="Product" value={product.name} />
          <Meta label="Assessment date" value={assessed} />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-faint">Overall result</p>
            <StatusPill {...resultPill(product.result)} size="sm" className="mt-1.5" />
          </div>
        </div>

        {/* The packet, beside what was concluded about it.
            Two columns on a wide screen and stacked below it: the photograph
            is evidence for the summary next to it, and reading one while
            scrolling to find the other is what made the old report hard to
            check. The image is capped so it stays illustrative rather than
            taking the page. */}
        <div className="grid gap-6 border-b border-line px-7 py-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Scanned product</h3>

            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={`Label photographed for scan ${product.scanId}`}
                className="mt-2.5 w-full rounded-lg border border-line object-contain"
                style={{ maxHeight: 280 }}
              />
            ) : (
              <p className="mt-2.5 rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center text-[12.5px] text-muted">
                Product image unavailable
              </p>
            )}
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Assessment</h3>

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <StatusPill {...resultPill(product.result)} />
              <span className="text-[13px] text-muted">
                Score <span className="tnum font-mono text-ink">{product.score}</span>
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {product.fields.slice(0, 6).map((field) => (
                <div key={field.key}>
                  <dt className="text-[11px] uppercase tracking-wider text-faint">{field.label}</dt>
                  <dd className="mt-0.5 text-[13px] text-ink">
                    {field.value ?? <span className="text-muted">Not detected</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <CardBody className="px-7 py-6">
          <h3 className="font-display text-sm font-semibold text-ink">Field checks</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                  <th className="py-2 pr-3 font-semibold">Requirement</th>
                  <th className="py-2 pr-3 font-semibold">Detected</th>
                  <th className="py-2 pr-3 font-semibold">Provision</th>
                  <th className="py-2 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {product.checks.map((check) => (
                  <tr key={check.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-[13px] text-ink">{check.label}</td>
                    <td className="py-2.5 pr-3 text-[12.5px] text-muted">{check.detected ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-[11.5px] text-muted">{check.provision}</td>
                    <td className="py-2.5">
                      <StatusPill {...checkPill(check.status)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-7 font-display text-sm font-semibold text-ink">Recognised text</h3>
          <p className="mt-1 text-[11.5px] text-muted">
            Mean recognition confidence{" "}
            <span className="tnum font-mono text-ink">{product.ocrConfidence}%</span>. Reproduced
            exactly as recognised, including its errors.
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 font-mono text-[11px] leading-relaxed text-ink-2">
            {product.rawText}
          </pre>

          <h3 className="mt-7 font-display text-sm font-semibold text-ink">What this report is</h3>
          <AssessmentNotice className="mt-2" />
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
            Automated text recognition can misread a label. Where a value was read with low
            confidence, or where a requirement&rsquo;s scope is conditional, the check is reported as
            needing review rather than as a failure. A finding here is a prompt for verification by
            a person, not a conclusion about a product or its manufacturer.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-1 text-[13.5px] font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
