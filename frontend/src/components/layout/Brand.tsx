import { cn } from "@/lib/cn";

import logo from "@/assets/niriksha-logo.png";
import logoLight from "@/assets/niriksha-logo-light.png";
import mark from "@/assets/niriksha-mark.png";
import markLight from "@/assets/niriksha-mark-light.png";

/**
 * The NIRIKSHA logo.
 *
 * Two artworks, not one recoloured with a CSS filter: the mark is near-black
 * green and vanishes on the dark console, so a brightened variant is used
 * there. `onDark` picks between them — it describes the surface the logo sits
 * on, not the logo itself.
 *
 * The full lockup already contains the wordmark and tagline, so nothing that
 * uses it should repeat either in text.
 */

const ALT = "NIRIKSHA — Smart Compliance. Safer India.";

export function BrandMark({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <img
      src={onDark ? markLight : mark}
      alt=""
      aria-hidden="true"
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
  );
}

export function BrandLockup({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <img
      src={onDark ? logoLight : logo}
      alt={ALT}
      className={cn("h-auto w-full max-w-[12rem] select-none", className)}
      draggable={false}
    />
  );
}

export { logo as brandLogo, logoLight as brandLogoLight, mark as brandMark, markLight as brandMarkLight };
