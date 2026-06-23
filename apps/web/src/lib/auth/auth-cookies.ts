/** Pure cookie + redirect-path helpers. Security-critical: `safeReturnPath` is the open-redirect
 * guard for the OAuth `?return=` round-trip. */

/** Percent-decode, falling back to the raw value: a garbled `Cookie` header must never throw and 500. */
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

/** A safe post-login redirect target: a same-site path starting with a single `/`. Absolute,
 * protocol-relative `//host`, and backslash forms (browsers normalize `\` to `/`, so `/\host` ->
 * `//host`) fall back to `/`, so a crafted `?return=` can't open-redirect. */
export function safeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return "/";
  return raw;
}
