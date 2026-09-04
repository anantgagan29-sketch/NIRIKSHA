import { AlertTriangle, FileText, Flag } from "lucide-react";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { ResultBanner } from "@/components/compliance/ResultBanner";
import { CheckList } from "@/components/compliance/CheckList";
import { ProductSwitcher } from "@/components/inspection/ProductSwitcher";
import { useScanFromRoute } from "@/hooks/useScanFromRoute";
import { useLanguage } from "@/hooks/useLanguage";

export function Compliance() {
  const { t } = useLanguage();
  const { product, loading, error } = useScanFromRoute();

  const failures = product.checks.filter((check) => check.status === "fail");
  const reviews = product.checks.filter((check) => check.status === "review");
  const firstFailureField = failures[0]?.evidence;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={`Scan ${product.scanId}`}
        title={t("compliance.title")}
        description={t("compliance.description")}
        actions={
          <>
            <ButtonLink to="/reports" variant="secondary">
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t("compliance.viewReport")}
            </ButtonLink>
            {product.result !== "compliant" && (
              <ButtonLink to="/complaints" variant="danger">
                <Flag className="h-4 w-4" aria-hidden="true" />
                {t("compliance.reportProduct")}
              </ButtonLink>
            )}
          </>
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

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <ResultBanner result={product.result} checks={product.checks} score={product.score} />

          {failures.length > 0 && (
            <Card className="border-fail/25">
              <CardHeader
                title={`Potential issues (${failures.length})`}
                action={
                  <span className="flex items-center gap-1.5 text-[11.5px] text-fail">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Needs authority verification
                  </span>
                }
              />
              <CardBody className="p-0">
                <CheckList checks={failures} />
              </CardBody>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="border-review/25">
              <CardHeader title={`Needs review (${reviews.length})`} />
              <CardBody className="p-0">
                <CheckList checks={reviews} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title={t("compliance.allChecks")}
              action={<span className="text-[11.5px] text-muted">Select a check for its evidence</span>}
            />
            <CardBody className="p-0">
              <CheckList checks={product.checks} />
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title={t("compliance.evidenceImage")} />
            <CardBody className="bg-canvas/60">
              <Specimen product={product} highlight={firstFailureField} />
              {firstFailureField && (
                <p className="mx-auto mt-3 max-w-[19rem] text-center text-[11.5px] leading-relaxed text-muted">
                  The declaration behind the first failed check is marked on the label.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("compliance.classification")} />
            <CardBody className="flex flex-col gap-2.5">
              <p className="text-[11.5px] leading-relaxed text-muted">
                Classification decides which requirements apply, so a rule that does not govern this
                package is marked not applicable rather than failed.
              </p>
              {product.checks
                .filter((check) => check.status === "not_applicable")
                .map((check) => (
                  <div key={check.id} className="rounded-lg border border-line bg-canvas px-3.5 py-2.5">
                    <p className="text-[12.5px] font-medium text-ink">{check.label}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{check.reason}</p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-faint">{check.provision}</p>
                  </div>
                ))}
            </CardBody>
          </Card>

          <AssessmentNotice />
        </div>
      </div>
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
