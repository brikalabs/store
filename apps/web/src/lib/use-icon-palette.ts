import { useEffect, useState } from "react";
import { type Gradient, gradientFor } from "../components/clay/gradients";

/**
 * Derive a plugin's accent gradient from its actual icon instead of a random
 * hash. We draw the icon to a tiny canvas, pick its most saturated meaningful
 * color (ignoring transparent / near-white / near-black pixels), and build a
 * light→dark gradient from it. Falls back to the deterministic hash gradient
 * when there's no icon, the image can't be read (CORS), or it's monochrome.
 */
export function useIconPalette(iconUrl: string | undefined, seed: string): Gradient {
  const [gradient, setGradient] = useState<Gradient>(() => gradientFor(seed));

  useEffect(() => {
    setGradient(gradientFor(seed));
    if (!iconUrl || typeof document === "undefined") return;

    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const extracted = extractGradient(img);
      if (active && extracted) setGradient(extracted);
    };
    img.src = iconUrl;
    return () => {
      active = false;
    };
  }, [iconUrl, seed]);

  return gradient;
}

/** Draw the icon to a tiny canvas and read back its RGBA pixels (null if 2D unsupported). */
function readIconPixels(img: HTMLImageElement): Uint8ClampedArray | null {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
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
 * The icon's main color, by area rather than by peak saturation. Meaningful
 * pixels are binned into a coarse RGB histogram (4 bits/channel, so shades
 * merge); the heaviest bin wins, each pixel weighted slightly by its saturation
 * so a large flat background beats a small bright accent while a faint tint still
 * reads. Returns the winning bin's mean color, or null when nothing meaningful
 * remains. Averaging every colored pixel instead would blend a blue-and-yellow
 * icon into a muddy grey.
 */
function dominantColor(data: Uint8ClampedArray): { r: number; g: number; b: number } | null {
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

function extractGradient(img: HTMLImageElement): Gradient | null {
  try {
    const data = readIconPixels(img);
    if (!data) return null;
    const color = dominantColor(data);
    if (!color) return null;
    const { r, g, b } = color;
    return [shift(r, g, b, 1.15, 22), shift(r, g, b, 0.72, 0)];
  } catch {
    // canvas tainted by a non-CORS image; keep the hash fallback.
    return null;
  }
}

function shift(r: number, g: number, b: number, factor: number, lift: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * factor + lift)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
