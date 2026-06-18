/**
 * Deterministic "app store" gradients for plugin/author tiles. A stable hash of
 * the seed (plugin name, author id) picks a hue, and the gradient is generated
 * from it on the fly - so the same entity always renders the same colorful icon
 * without storing anything or drawing from a fixed palette.
 */
export type Gradient = readonly [string, string];

export function hashString(input: string): number {
  // Polynomial rolling hash reduced modulo the Mersenne prime 2^31 - 1, which
  // keeps every intermediate an exact integer (so no `| 0` truncation) while
  // staying deterministic and non-negative.
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + (input.codePointAt(index) ?? 0)) % 2_147_483_647;
  }
  return hash;
}

/** Convert an HSL color (h in degrees, s/l in 0..1) to a `#rrggbb` hex string. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number): string => {
    const k = (n + hue / 30) % 12;
    const value = lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Build the deterministic two-stop gradient for a seed: a vivid start hue paired
 * with an analogous, deeper end hue, so tiles stay colorful and varied.
 */
export function gradientFor(seed: string): Gradient {
  const hue = hashString(seed) % 360;
  return [hslToHex(hue, 0.78, 0.62), hslToHex((hue + 28) % 360, 0.72, 0.46)];
}

export function gradientCss(gradient: Gradient, angle = 140): string {
  return `linear-gradient(${angle}deg, ${gradient[0]}, ${gradient[1]})`;
}
