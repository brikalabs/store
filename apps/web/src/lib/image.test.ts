import { describe, expect, test } from "bun:test";
import { type Image, image, targetSize } from "./image";

/** The pure resize geometry. The encode step is browser-only (createImageBitmap + OffscreenCanvas),
 *  so it is covered by typecheck + the UI, not here; the math is what can go subtly wrong. */
describe("targetSize", () => {
  test("inside downscales the longest edge, keeping aspect ratio", () => {
    expect(targetSize({ width: 2000, height: 1000 }, { width: 512, height: 512 })).toEqual({
      width: 512,
      height: 256,
    });
    expect(targetSize({ width: 1000, height: 2000 }, { width: 512, height: 512 })).toEqual({
      width: 256,
      height: 512,
    });
  });

  test("inside never upscales a source already within the box", () => {
    expect(targetSize({ width: 100, height: 80 }, { width: 512, height: 512 })).toEqual({
      width: 100,
      height: 80,
    });
  });

  test("inside honours a single constraint (width only)", () => {
    expect(targetSize({ width: 1000, height: 500 }, { width: 200 })).toEqual({
      width: 200,
      height: 100,
    });
  });

  test("cover returns the exact box (the crop happens at draw time)", () => {
    expect(
      targetSize({ width: 2000, height: 1000 }, { width: 512, height: 512, fit: "cover" }),
    ).toEqual({
      width: 512,
      height: 512,
    });
  });

  test("no resize passes the source size through", () => {
    expect(targetSize({ width: 640, height: 480 }, undefined)).toEqual({ width: 640, height: 480 });
  });
});

describe("image() chaining is lazy + immutable", () => {
  const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

  test("each step returns a new Image and nothing runs until toBlob()", () => {
    // No createImageBitmap call here (it would throw in bun) - building the pipeline is pure.
    const base = image(file);
    const resized: Image = base.resize({ width: 512 });
    const encoded: Image = resized.webp({ quality: 0.8 });
    expect(resized).not.toBe(base);
    expect(encoded).not.toBe(resized);
  });
});
