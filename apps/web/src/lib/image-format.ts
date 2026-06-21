/**
 * Detect a raster image's MIME type from its magic bytes (file signature), so an upload is
 * validated by what it ACTUALLY is, not the client-declared `Content-Type` (which the client
 * controls). Returns the detected type, or undefined when the bytes match no known signature.
 * Covers the formats the store accepts for avatars and scope icons (PNG, JPEG, WebP); SVG is
 * intentionally absent (script-in-SVG surface), so an SVG sniffs to undefined and is rejected.
 */
export function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // WebP is a RIFF container: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP".
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return undefined;
}

/** Whether `bytes` begins with the exact `prefix` byte sequence. */
function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}
