import { describe, expect, test } from "bun:test";
import { dominantSvgColor } from "./use-icon-palette";

// A weather-style icon as the registry generates them: a vivid gradient-filled
// background plus a white glyph stroked on top.
const weatherIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="icon-studio-bg"><stop offset="0" stop-color="#2193B0"/><stop offset="1" stop-color="#6DD5ED"/></linearGradient></defs><rect width="512" height="512" fill="url(#icon-studio-bg)"/><g fill="none" stroke="#FFFFFF" stroke-width="2"><path d="M13.997 4a2 2 0 0 1 1.76 1.05"/></g></svg>`;

describe("dominantSvgColor", () => {
  test("picks the vivid background color, not the white glyph stroke", () => {
    const color = dominantSvgColor(weatherIcon);
    expect(color).toEqual({ r: 0x21, g: 0x93, b: 0xb0 });
    // Blue is the dominant channel - the banner comes out blue, not pink.
    expect(color?.b).toBeGreaterThan(color?.r ?? 0);
    expect(color?.b).toBeGreaterThan(color?.g ?? 0);
  });

  test("expands 3-digit hex", () => {
    expect(dominantSvgColor('<rect fill="#09f" />')).toEqual({ r: 0x00, g: 0x99, b: 0xff });
  });

  test("returns null when only near-white/near-black colors are declared", () => {
    expect(dominantSvgColor('<g stroke="#ffffff" /><path fill="#000000" />')).toBeNull();
  });

  test("prefers the most saturated of several colors", () => {
    // Muted grey-blue (low saturation) vs a vivid red - the red wins.
    expect(dominantSvgColor('<rect fill="#6b7280" /><rect fill="#ef4444" />')).toEqual({
      r: 0xef,
      g: 0x44,
      b: 0x44,
    });
  });
});
