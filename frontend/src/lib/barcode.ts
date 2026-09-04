/**
 * Barcode validation.
 *
 * A camera reading a barcode at an angle, or a person typing one in, can both
 * produce something that looks like a number but is not a real code. The
 * retail symbologies carry a check digit precisely so that can be caught, and
 * checking it here means an obviously wrong code never reaches the backend or
 * gets shown to someone as though it were the product's identity.
 *
 * Codes without a check digit — Code 128, Code 39 — are validated on shape
 * alone, because there is nothing more to verify. Claiming otherwise would be
 * pretending to a certainty the symbology does not offer.
 */

export type BarcodeFormat =
  | "EAN-13"
  | "EAN-8"
  | "UPC-A"
  | "UPC-E"
  | "Code 128"
  | "Code 39"
  | "ITF"
  | "QR Code";

export interface BarcodeCheck {
  valid: boolean;
  /** Why it was rejected, phrased for the person holding the packet. */
  reason?: string;
}

/**
 * The GS1 modulo-10 check digit, used by EAN-13, EAN-8, UPC-A and ITF-14.
 *
 * Digits are weighted alternately from the right, and the check digit is what
 * takes the total to the next multiple of ten.
 */
function gs1CheckDigit(digits: string): number {
  let sum = 0;

  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[digits.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }

  return (10 - (sum % 10)) % 10;
}

function checksumHolds(code: string): boolean {
  const body = code.slice(0, -1);
  const check = Number(code[code.length - 1]);
  return gs1CheckDigit(body) === check;
}

export function validateBarcode(raw: string, format?: BarcodeFormat): BarcodeCheck {
  const code = raw.trim();

  if (!code) return { valid: false, reason: "Enter a barcode number." };

  // QR and the alphanumeric symbologies are not numeric, so the numeric rules
  // below do not apply to them.
  if (format === "QR Code" || format === "Code 128" || format === "Code 39") {
    return code.length >= 4
      ? { valid: true }
      : { valid: false, reason: "That code looks too short to be a product barcode." };
  }

  if (!/^\d+$/.test(code)) {
    return { valid: false, reason: "A product barcode contains digits only." };
  }

  // Lengths that carry a GS1 check digit.
  if ([8, 12, 13, 14].includes(code.length)) {
    return checksumHolds(code)
      ? { valid: true }
      : {
          valid: false,
          reason:
            "That barcode's check digit does not match, so it was read incorrectly or mistyped.",
        };
  }

  // UPC-E is a compressed form; its check digit only verifies once expanded,
  // which is not something to attempt from a partial read.
  if (code.length === 6 || code.length === 7) return { valid: true };

  // ITF is even-length and carries no universal check digit at other lengths.
  if (code.length >= 4 && code.length % 2 === 0) return { valid: true };

  return { valid: false, reason: "That is not a length any product barcode uses." };
}

/** What a detected code most likely is, from its length. */
export function guessFormat(code: string): BarcodeFormat | null {
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 13) return "EAN-13";
  if (code.length === 12) return "UPC-A";
  if (code.length === 8) return "EAN-8";
  if (code.length === 6 || code.length === 7) return "UPC-E";
  return null;
}
