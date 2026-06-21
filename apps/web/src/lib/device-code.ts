// Device codes are two groups of 4 from an ambiguity-free alphabet (see the
// registry). The OTP holds the 8 characters without the separating hyphen,
// which we strip on the way in and re-add when approving.
export const CODE_LENGTH = 8;
const NON_CODE_CHARS = /[^BCDFGHJKLMNPQRSTVWXZ23456789]/g;

/** Drop the separator and anything outside the code alphabet. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(NON_CODE_CHARS, "").slice(0, CODE_LENGTH);
}

/** Re-insert the hyphen the registry stores: `BR7KMNPQ` -> `BR7K-MNPQ`. */
export function withSeparator(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

/** True only on a local dev origin; auto-approval is gated to these. */
export function isLocalHost(): boolean {
  if (typeof document === "undefined") return false;
  const { hostname } = globalThis.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}
