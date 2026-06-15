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
    const img = new window.Image();
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

function extractGradient(img: HTMLImageElement): Gradient | null {
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    let bestSat = 0;
    let satR = 0;
    let satG = 0;
    let satB = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] as number;
      const g = data[i + 1] as number;
      const b = data[i + 2] as number;
      const a = data[i + 3] as number;
      if (a < 128) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 240 && min > 240) continue; // near-white
      if (max < 24) continue; // near-black
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
      const sat = max - min;
      if (sat > bestSat) {
        bestSat = sat;
        satR = r;
        satG = g;
        satB = b;
      }
    }

    if (count === 0) return null;
    const useSaturated = bestSat > 40;
    const r = useSaturated ? satR : sumR / count;
    const g = useSaturated ? satG : sumG / count;
    const b = useSaturated ? satB : sumB / count;
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
