import { describe, expect, test } from "bun:test";
import { dominantColor } from "./use-icon-palette";

/** Build an RGBA buffer from runs of `[count, [r, g, b]]` (all fully opaque). */
function rgba(runs: Array<[number, [number, number, number]]>): Uint8ClampedArray {
  const total = runs.reduce((sum, [count]) => sum + count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [count, [r, g, b]] of runs) {
    for (let k = 0; k < count; k++) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
      i += 4;
    }
  }
  return data;
}

describe("dominantColor", () => {
  test("picks the largest colored area, not the brightest accent", () => {
    // A weather icon on a canvas: a big blue field, a small vivid yellow sun, a
    // white cloud. Blue must win even though yellow is more saturated.
    const color = dominantColor(
      rgba([
        [600, [33, 147, 176]], // blue background
        [80, [251, 191, 36]], // yellow sun
        [340, [255, 255, 255]], // white cloud
      ]),
    );
    expect(color).not.toBeNull();
    expect(color?.b).toBeGreaterThan(color?.r ?? 0);
    expect(color?.b).toBeGreaterThan(color?.g ?? 0);
  });

  test("ignores transparent, near-white and near-black pixels", () => {
    const color = dominantColor(
      rgba([
        [50, [255, 255, 255]], // near-white
        [50, [0, 0, 0]], // near-black
        [100, [220, 40, 40]], // the only meaningful color
      ]),
    );
    expect(color?.r).toBeGreaterThan(color?.g ?? 0);
    expect(color?.r).toBeGreaterThan(color?.b ?? 0);
  });

  test("returns null when no meaningful pixels remain", () => {
    expect(dominantColor(rgba([[100, [255, 255, 255]]]))).toBeNull();
  });
});
