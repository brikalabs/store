/** A deterministic two-stop "app store" gradient for a plugin/author tile. */
export type Gradient = readonly [string, string];

/** Stable, deterministic non-negative hash of a seed string. */
export function hashString(input: string): number {
  // Reduced modulo the Mersenne prime 2^31 - 1 so every intermediate stays an
  // exact integer (no `| 0` truncation) while staying deterministic.
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

/** The deterministic gradient for a seed: a vivid start hue and an analogous, deeper end hue. */
export function gradientFor(seed: string): Gradient {
  const hue = hashString(seed) % 360;
  return [hslToHex(hue, 0.78, 0.62), hslToHex((hue + 28) % 360, 0.72, 0.46)];
}

/** A `Gradient` as a CSS `linear-gradient(...)` string. */
export function gradientCss(gradient: Gradient, angle = 140): string {
  return `linear-gradient(${angle}deg, ${gradient[0]}, ${gradient[1]})`;
}
