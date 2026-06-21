import { describe, expect, test } from "bun:test";
import { sniffImageMime } from "./image-format";

describe("sniffImageMime", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  // "RIFF" + 4-byte size + "WEBP".
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  test("detects PNG / JPEG / WebP by signature", () => {
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  test("returns undefined for a non-image (e.g. an SVG/HTML polyglot) and for truncated bytes", () => {
    expect(sniffImageMime(new TextEncoder().encode("<svg xmlns=...>"))).toBeUndefined();
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeUndefined(); // RIFF, no WEBP
    expect(sniffImageMime(new Uint8Array([0x89]))).toBeUndefined();
  });
});
