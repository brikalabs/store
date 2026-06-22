/**
 * Tarball integrity helpers. Digests are computed at publish time and pinned in the lockfile, so the
 * registry operator cannot silently change installed bytes after the fact. Web Crypto, so the core
 * stays runtime-agnostic.
 */

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary);
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

// Copies into a fresh ArrayBuffer-backed view so the Web Crypto signature is satisfied regardless
// of the caller's buffer type; the copy is negligible for plugin tarballs.
async function digest(algorithm: "SHA-512" | "SHA-1", data: Uint8Array): Promise<ArrayBuffer> {
  const view = new Uint8Array(data.byteLength);
  view.set(data);
  return crypto.subtle.digest(algorithm, view);
}

/** Subresource Integrity string for a tarball, e.g. `sha512-<base64>`. */
export async function sha512Integrity(data: Uint8Array): Promise<string> {
  return `sha512-${toBase64(await digest("SHA-512", data))}`;
}

/** Legacy SHA-1 hex digest for `dist.shasum`. */
export async function sha1Hex(data: Uint8Array): Promise<string> {
  return toHex(await digest("SHA-1", data));
}
