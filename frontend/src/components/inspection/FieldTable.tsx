import { useState } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusPill, fieldPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/cn";
import type { ExtractedField } from "@/data/types";

/**
 * Structured extraction, not a text dump.
 *
 * The raw recognised text is available behind a control, but it is never the
 * primary interface: what a person needs is each declaration, its value, and
 * how much the reading of it can be trusted.
 */
export function FieldTable({
  fields,
  rawText,
  confidence,
  className,
}: {
  fields: ExtractedField[];
  rawText?: string;
  confidence?: number;
  className?: string;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  // A confidence figure only exists where characters were scored, which is
  // the on-device reader. Its absence is how the two paths are told apart.
  const onDevice = confidence !== undefined && confidence > 0;
  const found = fields.filter((field) => field.status !== "missing").length;

  return (
    <>
      <Card className={className}>
        <CardHeader
          title="Extracted Information"
          action={
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted sm:block">
                {found} of {fields.length} detected
              </span>
              {rawText && (
                <Button variant="ghost" size="sm" onClick={() => setRawOpen(true)}>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {onDevice ? "View Raw OCR Text" : "View Model Response"}
                </Button>
              )}
            </div>
          }
        />

        <CardBody className="p-0">
          <ul className="divide-y divide-[var(--color-line)]">
            {fields.map((field, index) => (
              <motion.li
                key={field.key}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.35), duration: 0.26 }}
                className="flex items-start gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-medium text-muted">{field.label}</p>
                  <p
                    className={cn(
                      "mt-0.5 break-words text-[14px]",
                      field.value ? "text-ink" : "italic text-faint",
                    )}
                  >
                    {field.value ?? "Not detected"}
                  </p>
                  {field.evidence && field.evidence !== field.value && (
                    <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-faint">
                      read as “{field.evidence}”
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusPill {...fieldPill(field.status)} size="sm" />
                  {field.confidence !== null && (
                    <span
                      className={cn(
                        "tnum font-mono text-[11px]",
                        field.confidence >= 80 ? "text-pass" : field.confidence >= 65 ? "text-review" : "text-fail",
                      )}
                    >
                      {field.confidence}% confidence
                    </span>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Modal
        open={rawOpen}
        onClose={() => setRawOpen(false)}
        title={onDevice ? "Raw recognised text" : "What the model returned"}
      >
        <div className="p-5">
          {/* A mean confidence belongs to the on-device reader, which scores
              every character it recognises. The hosted models return named
              declarations and no such figure, and printing 0% for them said
              something false about a reading that was never scored. */}
          <p className="mb-3 text-xs text-muted">
            {onDevice ? (
              <>
                Mean recognition confidence{" "}
                <span className="tnum font-mono text-ink">{confidence}%</span>. Preserved exactly
                as recognised, including its errors — nothing here has been silently corrected.
              </>
            ) : (
              <>
                The vision model&rsquo;s own response, unedited. Every declaration above was read
                from this, so a finding can be checked against the evidence behind it.
              </>
            )}
          </p>
          <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 font-mono text-[11.5px] leading-relaxed text-ink-2">
            {rawText}
          </pre>
        </div>
      </Modal>
    </>
  );
}
