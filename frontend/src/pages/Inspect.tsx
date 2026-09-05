import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCw, ScanBarcode, Sparkles } from "lucide-react";
import { CameraCapture } from "@/components/ui/CameraCapture";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { PageHeader, AssessmentNotice } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/UploadZone";
import { LabelSpecimen } from "@/components/ui/LabelSpecimen";
import { StatusPill, resultPill, DemoBadge } from "@/components/ui/StatusPill";
import { ProgressBar } from "@/components/ui/Progress";
import { PipelineRail } from "@/components/inspection/PipelineRail";
import { QualityPanel } from "@/components/inspection/QualityPanel";
import { useInspection } from "@/hooks/useInspection";
import { useSelectedProduct } from "@/hooks/useSelectedProduct";
import { HAS_BACKEND } from "@/services/nirikshaApi";
import { useToast } from "@/components/ui/Toast";
import { DEMO_PRODUCTS } from "@/data/demoProducts";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * The inspection workspace.
 *
 * The left column holds what is being examined; the right column holds the
 * pipeline examining it. The gate between them is deliberate: the workflow
 * cannot advance past a frame that is too poor to read.
 */
export function Inspect() {
  const { t } = useLanguage();
  const { state, startDemo, startUpload, runPipeline, reset } = useInspection();
  const navigate = useNavigate();
  const toast = useToast();
  const { registerLive, select: selectProduct } = useSelectedProduct();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>(["eng"]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // A scanned code identifies the pack; it is carried alongside the
  // inspection, never in place of it.
  const [barcode, setBarcode] = useState<{ value: string; format: string | null } | null>(null);

  const product = state.product;
  const busy = state.phase === "running";

  /**
   * Hands the finished scan to the result screens. A live run is published as
   * a scan record of its own; a demo run simply selects its fixture.
   */
  function openResults(to: string) {
    if (state.source === "live" && state.result) {
      registerLive({
        id: "live-scan",
        scanId: `NIR-2026-${String(Date.now()).slice(-5)}`,
        name: state.fields.find((f) => f.key === "product_name")?.value ?? "Uploaded product",
        category: "Live scan",
        netQuantity: state.fields.find((f) => f.key === "net_quantity")?.value ?? "—",
        labelLines: [],
        imageUrl: state.preview ?? undefined,
        isLive: true,
        readOnDevice: state.readOnDevice,
        result: state.result,
        score: state.score,
        quality: state.quality!,
        fields: state.fields,
        checks: state.checks,
        rawText: state.rawText,
        ocrConfidence: state.ocrConfidence,
        scannedAt: new Date().toISOString(),
      });
    } else if (product) {
      selectProduct(product.id);
    }
    navigate(to);
  }

  function choose(id: string) {
    setSelectedId(id);
    void startDemo(id);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t("inspect.eyebrow")}
        title={t("inspect.title")}
        description={t("inspect.description")}
        actions={
          product && (
            <Button variant="secondary" size="sm" onClick={() => { reset(); setSelectedId(null); }}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Start over
            </Button>
          )
        }
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ------------------------------------------------ specimen column */}
        <div className="flex min-w-0 flex-col gap-5">
          {!product && state.source !== "live" ? (
            <>
              <Card>
                <CardHeader title={t("inspect.captureOrUpload")} />
                <CardBody>
                  <UploadZone
                    onSelect={(file) => {
                      toast("info", "Measuring your image — recognition runs on this device.");
                      void startUpload(file);
                    }}
                    onCamera={() => setCameraOpen(true)}
                    onBarcode={() => setScannerOpen(true)}
                  />

                  {/* A scanned code is held in view while the label is
                      photographed, so it is clear the scan was recorded — and
                      equally clear that it is not the assessment. */}
                  {barcode && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-canvas px-4 py-3">
                      <ScanBarcode className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      <span className="font-mono text-[13px] font-medium text-ink">
                        {barcode.value}
                      </span>
                      {barcode.format && (
                        <span className="text-[12px] text-muted">{barcode.format}</span>
                      )}
                      <span className="text-[12px] text-muted">
                        {t("inspect.barcodeRecorded")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBarcode(null)}
                        className="ml-auto text-[12px] font-medium text-brand-700 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={t("inspect.sampleProducts")}
                  action={<DemoBadge />}
                />
                <CardBody className="flex flex-col gap-2.5">
                  <p className="mb-1 text-[13px] leading-relaxed text-muted">
                    Each sample carries a real declaration set and runs through every stage of the
                    workspace. They are demonstration products, not real commodities.
                  </p>
                  {DEMO_PRODUCTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => choose(item.id)}
                      className={cn(
                        "flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 text-left transition-all hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm",
                        selectedId === item.id && "border-brand-400 bg-brand-50",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                      >
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {item.category} · {item.netQuantity}
                        </span>
                      </span>
                      <StatusPill {...resultPill(item.result)} size="sm" />
                    </button>
                  ))}
                </CardBody>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader
                title={product ? product.name : "Your image"}
                action={
                  <div className="flex items-center gap-2">
                    {product ? <DemoBadge /> : <StatusPill tone="busy" label="Live image" size="sm" />}
                    {product?.gtin && (
                      <span className="hidden items-center gap-1.5 font-mono text-[11px] text-muted sm:flex">
                        <ScanBarcode className="h-3.5 w-3.5" aria-hidden="true" />
                        {product.gtin}
                      </span>
                    )}
                  </div>
                }
              />
              <CardBody className="bg-canvas/60">
                <div className="relative">
                  {product ? (
                    <LabelSpecimen lines={product.labelLines} />
                  ) : (
                    // Rendering an <img> with an empty src makes the browser
                    // re-request the page, so the element waits for a real URL.
                    state.preview && (
                      <img
                        src={state.preview}
                        alt="The label you uploaded"
                        className="mx-auto max-h-[26rem] w-auto max-w-full rounded-md border border-line object-contain"
                      />
                    )
                  )}

                  {/* Scanning pass, shown only while the pipeline is working. */}
                  <AnimatePresence>
                    {busy && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
                        aria-hidden="true"
                      >
                        <motion.div
                          initial={{ y: "-10%" }}
                          animate={{ y: "110%" }}
                          transition={{ duration: 2.1, repeat: Infinity, ease: "linear" }}
                          className="h-14 w-full bg-gradient-to-b from-transparent via-brand-400/35 to-transparent"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {state.phase === "done" && (
                  <p className="mx-auto mt-4 max-w-[19rem] text-center text-[11.5px] leading-relaxed text-muted">
                    Regions carrying declarations were located and read. Confidence for each value is
                    reported in the extraction panel.
                  </p>
                )}
              </CardBody>

              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
                <span className="font-mono text-[11px] text-faint">
                  {product
                    ? product.scanId
                    : state.imageSize
                      ? `${state.imageSize.width} × ${state.imageSize.height} px`
                      : "Uploaded image"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    reset();
                    setSelectedId(null);
                  }}
                  disabled={busy}
                >
                  {product ? "Choose a different product" : "Use a different image"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* ------------------------------------------------ pipeline column */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader
              title={t("inspect.pipeline")}
              action={
                state.phase !== "idle" && (
                  <span className="tnum font-mono text-[11px] text-muted">
                    {state.serverBusy ? "Server working…" : `${state.progress}%`}
                  </span>
                )
              }
            />
            {state.phase !== "idle" && (
              <ProgressBar
                value={state.progress}
                indeterminate={state.serverBusy}
                className="rounded-none"
              />
            )}
            <CardBody>
              <PipelineRail stages={state.stages} />
            </CardBody>
          </Card>

          <AnimatePresence mode="wait">
            {state.quality && (
              <motion.div
                key="quality"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col gap-5">
                  {state.source === "live" && state.quality.proceed && !HAS_BACKEND && (
                    <Card>
                      <CardHeader title={t("inspect.recognitionLanguage")} />
                      <CardBody className="flex flex-col gap-2.5">
                        <div className="flex gap-2">
                          {[
                            { value: ["eng"], label: "English" },
                            { value: ["eng", "hin"], label: "English + हिन्दी" },
                          ].map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => setLanguages(option.value)}
                              aria-pressed={languages.join("+") === option.value.join("+")}
                              disabled={busy}
                              className={cn(
                                "flex-1 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors",
                                languages.join("+") === option.value.join("+")
                                  ? "border-brand-400 bg-brand-50 font-medium text-brand-700"
                                  : "border-line text-muted hover:border-line-strong hover:text-ink",
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-muted">
                          Devanagari recognition on printed packaging is markedly less accurate than
                          English. Results are reported with confidence and should be reviewed.
                          Language data downloads on first use.
                        </p>
                      </CardBody>
                    </Card>
                  )}

                  {state.retakeTips.length > 0 && !state.quality.proceed && (
                    <Card className="border-review/25">
                      <CardHeader title={t("inspect.betterPhoto")} />
                      <CardBody>
                        <ul className="flex flex-col gap-2">
                          {state.retakeTips.map((tip) => (
                            <li key={tip} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-review" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </CardBody>
                    </Card>
                  )}

                  <QualityPanel
                    quality={state.quality}
                    busy={busy}
                    onContinue={() => void runPipeline(languages)}
                    onRetake={() => {
                      reset();
                      setSelectedId(null);
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {state.phase === "error" && state.error && (
            <Card className="border-fail/25" role="alert">
              <CardHeader title={t("inspect.couldNotComplete")} />
              <CardBody className="flex flex-col gap-3.5">
                <p className="text-[13px] leading-relaxed text-ink-2">{state.error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    reset();
                    setSelectedId(null);
                  }}
                >
                  Start again
                </Button>
              </CardBody>
            </Card>
          )}

          {state.phase === "done" && state.result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader
                  title={t("inspect.assessmentComplete")}
                  action={<StatusPill {...resultPill(state.result)} size="sm" />}
                />
                <CardBody className="flex flex-col gap-3.5">
                  <p className="text-[13px] leading-relaxed text-muted">
                    {state.fields.filter((f) => f.status !== "missing").length} declarations were
                    extracted and {state.checks.length} applicable requirements were evaluated.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button onClick={() => openResults("/scan-result")} className="flex-1 sm:flex-none">
                      View Extracted Information
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => openResults("/compliance")}
                      className="flex-1 sm:flex-none"
                    >
                      Compliance Analysis
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          <AssessmentNotice />
        </div>
      </div>

      {/* The camera hands back a File, which goes into startUpload — the same
          entry point the file picker uses. There is one inspection pipeline. */}
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setCameraOpen(false);
          toast("info", "Measuring your capture — recognition runs on this device.");
          void startUpload(file);
        }}
        onUploadInstead={() => setCameraOpen(false)}
      />

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onContinue={(value, format) => {
          setScannerOpen(false);
          setBarcode({ value, format });
          toast(
            "info",
            `Barcode ${value} recorded. Now photograph the declaration panel to assess compliance.`,
          );
        }}
        onUploadInstead={() => setScannerOpen(false)}
      />
    </div>
  );
}
