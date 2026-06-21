/** Longest edge (px) for a stored scope logo; larger uploads are downscaled to fit. */
const MAX_EDGE = 512;
/** WebP quality for the re-encoded logo (0..1). 0.85 is visually lossless for a small icon. */
const WEBP_QUALITY = 0.85;

/**
 * Downscale an image File to fit {@link MAX_EDGE} and re-encode it as WebP, in the BROWSER, before
 * upload. A user can pick a large photo and we still send (and store) a small logo, so the server's
 * size cap is never the thing that rejects a normal picture. Runs on the client only (Canvas APIs);
 * the server keeps validating the result as the backstop.
 */
export async function toResizedWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
  } finally {
    bitmap.close();
  }
}
