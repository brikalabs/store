import { useEffect, useState } from "react";
import { type Gradient, gradientFor } from "../components/clay/gradients";

/**
 * Derive a plugin's accent gradient from its actual icon instead of a random
 * hash. Plugin icons are SVGs, so we read the colors straight out of the markup
 * (`fill`/`stroke`/`stop-color`) - reliable and canvas-free, where drawing an
 * SVG with a gradient fill to a canvas often reads back blank. Raster icons fall
 * back to sampling pixels. Either way we take the icon's most vivid color and
 * build a light->dark gradient from it, falling back to the deterministic hash
 * gradient when there's no icon or no usable color.
 */
export function useIconPalette(iconUrl: string | undefined, seed: string): Gradient {
  const [gradient, setGradient] = useState<Gradient>(() => gradientFor(seed));

  useEffect(() => {
    setGradient(gradientFor(seed));
    if (!iconUrl) return;

    let active = true;
    iconGradient(iconUrl).then((extracted) => {
      if (active && extracted) setGradient(extracted);
    });
    return () => {
      active = false;
    };
  }, [iconUrl, seed]);

  return gradient;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Fetch the icon and derive a gradient from it, or null if nothing is usable. */
async function iconGradient(iconUrl: string): Promise<Gradient | null> {
  try {
    const response = await fetch(iconUrl);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    const color =
      type.includes("svg") || iconUrl.endsWith(".svg")
        ? dominantSvgColor(await response.text())
        : await dominantRasterColor(await response.blob());
    return color ? gradientFromColor(color) : null;
  } catch {
    return null;
  }
}

/** Light->dark two-stop gradient around a base color, matching the tile look. */
function gradientFromColor({ r, g, b }: Rgb): Gradient {
  return [shift(r, g, b, 1.15, 22), shift(r, g, b, 0.72, 0)];
}

const HEX_COLOR = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

/**
 * The icon's main color, read from the SVG source: the most saturated `#rrggbb`
 * (or `#rgb`) value, skipping the near-white/near-black used for glyphs and
 * outlines. Returns null when the markup declares no usable hex color.
 */
export function dominantSvgColor(svg: string): Rgb | null {
  let best: Rgb | null = null;
  let bestSat = -1;
  for (const match of svg.matchAll(HEX_COLOR)) {
    const color = parseHex(match[0]);
    if (!isMeaningful(color)) continue;
    const sat = saturation(color);
    if (sat > bestSat) {
      bestSat = sat;
      best = color;
    }
  }
  return best;
}

function parseHex(hex: string): Rgb {
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? `${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`
      : body;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function saturation({ r, g, b }: Rgb): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Skip transparent/near-white/near-black so a glyph or outline doesn't win. */
function isMeaningful({ r, g, b }: Rgb): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return !(max > 244 && min > 244) && max >= 20;
}

/** Decode a raster icon and read its area-dominant color from a 24x24 sample. */
async function dominantRasterColor(blob: Blob): Promise<Rgb | null> {
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 24, 24);
    return dominantColor(ctx.getImageData(0, 0, 24, 24).data);
  } finally {
    bitmap.close();
  }
}

interface ColorBin {
  r: number;
  g: number;
  b: number;
  weight: number;
}

interface Pixel {
  r: number;
  g: number;
  b: number;
  sat: number;
}

/** A meaningful pixel at offset `i`, or null for transparent/near-white/near-black. */
function meaningfulPixel(data: Uint8ClampedArray, i: number): Pixel | null {
  if ((data[i + 3] ?? 0) < 128) return null;
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 244 && min > 244) return null; // near-white
  if (max < 20) return null; // near-black
  return { r, g, b, sat: max - min };
}

/**
 * The dominant color of RGBA pixels, by area rather than by peak saturation.
 * Meaningful pixels are binned into a coarse RGB histogram (4 bits/channel, so
 * shades merge); the heaviest bin wins, each pixel weighted slightly by its
 * saturation so a large flat background beats a small bright accent. Returns the
 * winning bin's mean color, or null when nothing meaningful remains.
 */
function dominantColor(data: Uint8ClampedArray): Rgb | null {
  const bins = new Map<number, ColorBin>();
  let best: ColorBin | null = null;

  for (let i = 0; i < data.length; i += 4) {
    const px = meaningfulPixel(data, i);
    if (px === null) continue;
    const key = ((px.r >> 4) << 8) | ((px.g >> 4) << 4) | (px.b >> 4);
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, weight: 0 };
    const weight = 1 + px.sat / 32;
    bin.r += px.r * weight;
    bin.g += px.g * weight;
    bin.b += px.b * weight;
    bin.weight += weight;
    bins.set(key, bin);
    if (best === null || bin.weight > best.weight) best = bin;
  }

  if (best === null) return null;
  return { r: best.r / best.weight, g: best.g / best.weight, b: best.b / best.weight };
}

function shift(r: number, g: number, b: number, factor: number, lift: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * factor + lift)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
