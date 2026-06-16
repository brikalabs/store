/**
 * Pure cookie + redirect-path helpers, with no env, DB, or crypto dependency, so
 * they are unit-testable in isolation. The session/identity logic that needs the
 * Cloudflare runtime stays in `auth.ts` (and imports these). Security-critical:
 * `safeReturnPath` is the open-redirect guard for the OAuth `?return=` round-trip.
 */

/** Percent-decode, falling back to the raw value when the encoding is malformed.
 *  A garbled `Cookie` header must never throw and 500 the request. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Parse a `Cookie` header into a name -> value map (values percent-decoded). */
export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (header === null) return result;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key.length === 0) continue;
    result[key] = safeDecode(part.slice(eq + 1).trim());
  }
  return result;
}

/**
 * A safe post-login redirect target: a same-site path beginning with a single
 * `/`. Absolute URLs and protocol-relative `//host` paths fall back to `/`, so a
 * crafted `?return=` can never turn sign-in into an open redirect.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
