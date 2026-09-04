import { useRef, useState } from "react";
import { UploadCloud, Camera, ScanBarcode } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "./Button";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * The entry point to the workflow.
 *
 * Drag-and-drop, file picker and camera all funnel into one callback, so the
 * pages above never care how the image arrived.
 */
export function UploadZone({
  onSelect,
  onCamera,
  onBarcode,
  compact,
  className,
}: {
  onSelect: (file: File) => void;
  /** Opens the live camera. Falls back to the file picker when not provided. */
  onCamera?: () => void;
  onBarcode?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { t } = useLanguage();

  function accept(file?: File | null) {
    if (file && file.type.startsWith("image/")) onSelect(file);
  }

  return (
    <div className={className}>
      <motion.div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
        animate={{ scale: dragging ? 1.01 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "gap-3 px-5 py-8" : "gap-4 px-6 py-12",
          dragging ? "border-brand-500 bg-brand-50" : "border-line-strong bg-canvas/60",
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-surface text-brand-600"
        >
          <UploadCloud className="h-6 w-6" />
        </span>

        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium text-ink">{t("inspect.uploadTitle")}</p>
          <p className="text-[13px] text-muted">{t("inspect.uploadHint")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {t("inspect.uploadImage")}
          </Button>
          {/* A live camera, not a file picker with a camera hint: on a laptop
              the hint does nothing, and even on a phone it hands the capture
              to the system camera app rather than showing the framing guide
              that gets the declaration panel into shot. */}
          <Button size="sm" variant="secondary" onClick={() => onCamera?.() ?? fileRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t("inspect.useCamera")}
          </Button>
        </div>

        {onBarcode && (
          <>
            <div className="flex w-full max-w-[18rem] items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-medium tracking-wide text-faint">{t("inspect.or")}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Button size="sm" variant="subtle" onClick={onBarcode}>
              <ScanBarcode className="h-4 w-4" aria-hidden="true" />
              {t("inspect.scanBarcode")}
            </Button>
          </>
        )}

        <p className="pt-1 text-[11px] text-faint">{t("inspect.formats")}</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </motion.div>
    </div>
  );
}
