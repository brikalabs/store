import { image } from "@/lib/image";

/** Longest edge (px) for a stored scope logo; larger uploads are downscaled to fit. */
const MAX_EDGE = 512;
/** WebP quality for the re-encoded logo (0..1). 0.85 is visually lossless for a small icon. */
const WEBP_QUALITY = 0.85;

/** Downscale a File to fit {@link MAX_EDGE} and re-encode as WebP in the browser before upload. */
export function toResizedWebp(file: File): Promise<Blob> {
  return image(file)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside" })
    .webp({ quality: WEBP_QUALITY })
    .toBlob();
}
