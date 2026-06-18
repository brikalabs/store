import { useEffect, useState } from "react";
import { type Gradient, gradientFor } from "../components/clay/gradients";

/**
 * Derive a plugin's accent gradient from its actual icon, for any image format.
 * We rasterize the icon with the browser - which decodes png/jpeg/webp/gif/svg
 * alike - through a same-origin `blob:` URL (so the canvas isn't tainted) and
 * read its dominant color. SVG gradient fills can still read back blank or taint
 * a canvas in some browsers, so when sampling finds nothing we fall back to
 * reading the colors out of the SVG markup. Failing everything, we keep the
 * deterministic hash gradient.
 */
export function useIconPalette(iconUrl: string | undefined, seed: string): Gradient {
  const [gradient, setGradient] = useState<Gradient>(() => gradientFor(seed));

  useEffect(() => {
    setGradient(gradientFor(seed));
    if (!iconUrl) return;

    let active = true;
    iconColor(iconUrl).then((color) => {
      if (active && color) setGradient(gradientFromColor(color));
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

const SAMPLE = 24;

/** The icon's dominant color, from pixels for any format, or SVG markup as a fallback. */
async function iconColor(iconUrl: string): Promise<Rgb | null> {
  try {
    const response = await fetch(iconUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    const sampled = await sampleImageColor(blob);
    if (sampled) return sampled;

    const type = response.headers.get("content-type") ?? "";
    if (type.includes("svg") || iconUrl.endsWith(".svg")) return dominantSvgColor(await blob.text());
    return null;
  } catch {
    return null;
  }
}

/** Light->dark two-stop gradient around a base color, matching the tile look. */
function gradientFromColor({ r, g, b }: Rgb): Gradient {
  return [shift(r, g, b, 1.15, 22), shift(r, g, b, 0.72, 0)];
}

/** Rasterize any browser-renderable image to a small canvas and read its dominant color. */
async function sampleImageColor(blob: Blob): Promise<Rgb | null> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    if (image === null) return null;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) return null;
    ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    return dominantColor(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
  } catch {
    return null; // a tainted canvas throws on read (some SVGs)
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Load an `<img>` from a same-origin blob URL; resolves null on a decode/load error. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => resolve(null));
    image.src = src;
  });
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

const HEX_COLOR = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

/**
 * Fallback for SVG icons a canvas can't read: the most saturated `#rrggbb` (or
 * `#rgb`) declared in the markup, skipping the near-white/near-black used for
 * glyphs and outlines. Null when the markup declares no usable hex color.
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

function shift(r: number, g: number, b: number, factor: number, lift: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * factor + lift)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
