import { ArrowRight } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { StatusPill, resultPill, DemoBadge } from "@/components/ui/StatusPill";
import { FieldTable } from "@/components/inspection/FieldTable";
import { PipelineRail } from "@/components/inspection/PipelineRail";
import { ProductSwitcher } from "@/components/inspection/ProductSwitcher";
import { useScanFromRoute } from "@/hooks/useScanFromRoute";
import { cn } from "@/lib/cn";
import { PIPELINE_STAGES } from "@/data/pipeline";
import type { StageState } from "@/data/types";
import { useLanguage } from "@/hooks/useLanguage";

/** Every stage complete — this screen is only reached after a full run. */
const COMPLETED: Record<string, StageState> = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.id, "complete" as StageState]),
);

export function ScanResult() {
  const { t } = useLanguage();
  const { product, loading, error } = useScanFromRoute();

  const lowConfidence = product.fields.filter(
    (field) => field.confidence !== null && field.confidence < 70,
  ).length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={`Scan ${product.scanId}`}
        title={t("scanResult.title")}
        description="Structured declarations read from the label, each carrying the confidence of the reading it came from."
        actions={
          <ButtonLink to="/compliance">
            Run Compliance Analysis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        }
      />

      {/* A scan named in the URL is being fetched, or could not be. The
          second case matters: the page falls back to the current selection,
          and showing another product under the requested reference without
          saying so would be misleading. */}
      {loading && (
        <p className="mt-4 rounded-md border border-line bg-surface px-4 py-3 text-[13px] text-muted">
          Loading that scan…
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          That scan could not be loaded, so the current selection is shown instead. {error}
        </p>
      )}

      <ProductSwitcher className="mt-5" />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader
              title={product.name}
              action={
                <div className="flex items-center gap-2">
                  {product.isLive ? (
                    <StatusPill tone="busy" label="Live scan" size="sm" />
                  ) : (
                    <DemoBadge />
                  )}
                  <StatusPill {...resultPill(product.result)} size="sm" />
                </div>
              }
            />
            <CardBody className="bg-canvas/60">
              <Specimen product={product} />
            </CardBody>
            {/* A document-level recognition confidence only exists when the
                text was read by an OCR engine. The vision model reports
                confidence per declaration instead, so the column is dropped
                rather than shown as zero. */}
            <div
              className={cn(
                "grid divide-x divide-[var(--color-line)] border-t border-line",
                product.ocrConfidence > 0 ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              <Meta label="Category" value={product.category} />
              <Meta label="Net quantity" value={product.netQuantity} />
              {product.ocrConfidence > 0 && (
                <Meta label="OCR confidence" value={`${product.ocrConfidence}%`} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("scanResult.pipeline")} />
            <CardBody>
              <PipelineRail stages={COMPLETED} compact />
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {product.readOnDevice && (
            <div
              role="status"
              className="rounded-[var(--radius-card)] border border-review/25 bg-review-bg px-4 py-3.5"
            >
              <p className="text-[13.5px] font-semibold text-review">
                This label was read on your device, not by the vision service
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                The hosted models were unavailable, so the browser read the label itself. It
                recognises far less of a photographed pack, so treat the fields below as a partial
                reading rather than a finding about this package — a declaration missing here may
                simply not have been read. Scan again once the service is back.
              </p>
            </div>
          )}

          {lowConfidence > 0 && (
            <div
              role="status"
              className="rounded-[var(--radius-card)] border border-review/25 bg-review-bg px-4 py-3.5"
            >
              <p className="text-[13.5px] font-semibold text-review">
                {lowConfidence} {lowConfidence === 1 ? "value was" : "values were"} read at low confidence
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                These are reported as needing review rather than treated as fact. A value read
                poorly is not the same as a declaration that is absent, and the rule engine treats
                the two differently.
              </p>
            </div>
          )}

          <FieldTable
            fields={product.fields}
            rawText={product.rawText}
            confidence={product.ocrConfidence}
          />

          <AssessmentNotice />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}

function Specimen({
  product,
  highlight,
  compact,
}: {
  product: { labelLines: string[]; imageUrl?: string };
  highlight?: string;
  compact?: boolean;
}) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt="The label that was inspected"
        className="mx-auto max-h-[26rem] w-auto max-w-full rounded-md border border-line object-contain"
      />
    );
  }
  return <LabelSpecimen lines={product.labelLines} highlight={highlight} compact={compact} />;
}
