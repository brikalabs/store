import { useEffect, useState } from "react";
import { type Gradient, gradientFor } from "../components/clay/gradients";

/**
 * Derive a plugin's accent gradient from its actual icon. The icon is fetched,
 * rasterized on a canvas (the browser decodes png/jpeg/webp/svg alike) and its
 * dominant color sampled, then turned into a light->dark gradient. Falls back to
 * the deterministic hash gradient when there's no icon or it can't be read.
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

const SAMPLE = 32;

/** Fetch the icon and read its dominant color off a canvas, or null if unreadable. */
async function iconColor(iconUrl: string): Promise<Rgb | null> {
  if (typeof document === "undefined") return null;
  try {
    const response = await fetch(iconUrl);
    if (!response.ok) return null;
    // Don't trust the server's content-type: an `<img>` only decodes with a real
    // image MIME, so sniff it from the bytes (a mislabeled .svg would otherwise
    // fail to decode and fall back to the hash gradient).
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = imageMimeType(bytes) ?? response.headers.get("content-type") ?? "";
    // An SVG `<foreignObject>` can embed arbitrary HTML, so the browser taints the
    // canvas and getImageData throws; strip it (it's a decorative blur) so the
    // icon stays readable.
    const source = type.includes("svg")
      ? new Blob([stripCanvasTaint(new TextDecoder().decode(bytes))], { type })
      : new Blob([bytes], { type });
    const url = URL.createObjectURL(source);
    try {
      return await sampleColor(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

const FOREIGN_OBJECT = /<foreignObject[\s\S]*?<\/foreignObject>/gi;

/**
 * Remove `<foreignObject>` from SVG markup so the icon can be drawn to a canvas
 * and read back. It can embed arbitrary (even cross-origin) HTML, so browsers
 * taint the canvas when such an SVG is drawn and `getImageData` throws. The
 * element is decorative (a backdrop blur on these icons), so dropping it keeps
 * the colors intact.
 */
export function stripCanvasTaint(svg: string): string {
  return svg.replace(FOREIGN_OBJECT, "");
}

/** True when `bytes` begins with the byte signature `sig`. */
function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((byte, i) => bytes[i] === byte);
}

/** Sniff an image MIME from the leading bytes, so a wrong/missing content-type still decodes. */
export function imageMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

/** Draw the icon to a small canvas (same-origin blob, so it isn't tainted) and read it back. */
async function sampleColor(url: string): Promise<Rgb | null> {
  const image = new Image();
  image.src = url;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) return null;

  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
  return dominantColor(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
}

/** Light->dark two-stop gradient around a base color, matching the tile look. */
function gradientFromColor({ r, g, b }: Rgb): Gradient {
  return [shift(r, g, b, 1.15, 22), shift(r, g, b, 0.72, 0)];
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
 * shades merge); the heaviest bin wins, each pixel weighted gently by its
 * saturation so a large flat background beats a small bright accent (the blue
 * field of a weather icon over its yellow sun) while a near-grey field still
 * reads. Returns the winning bin's mean color, or null when nothing remains.
 */
export function dominantColor(data: Uint8ClampedArray): Rgb | null {
  const bins = new Map<number, ColorBin>();
  let best: ColorBin | null = null;

  for (let i = 0; i < data.length; i += 4) {
    const px = meaningfulPixel(data, i);
    if (px === null) continue;
    const key = ((px.r >> 4) << 8) | ((px.g >> 4) << 4) | (px.b >> 4);
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, weight: 0 };
    const weight = 1 + px.sat / 128;
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
