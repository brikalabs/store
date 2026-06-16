/**
 * @brika/plugin-icon - generate square SVG plugin icons from glyphs, gradients,
 * and monograms. A thin hub-facing wrapper over @brika/icon-studio-core.
 */

export interface IconSpec {
  /** A Lucide glyph name, or undefined to render a monogram instead. */
  readonly glyph?: string;
  /** Seed used to derive a stable gradient (usually the plugin name). */
  readonly seed: string;
  /** Optional label; its initials become the monogram when no glyph is set. */
  readonly label?: string;
}

const PALETTE = [
  ["#4F46E5", "#DB2777"],
  ["#0EA5E9", "#22D3EE"],
  ["#F97316", "#F43F5E"],
  ["#10B981", "#84CC16"],
  ["#8B5CF6", "#EC4899"],
];

/** A small, stable hash so the same seed always picks the same gradient. */
export function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Pick a deterministic two-stop gradient for a seed. */
export function gradientFor(seed: string): readonly [string, string] {
  const pair = PALETTE[hashSeed(seed) % PALETTE.length];
  return pair as [string, string];
}

/** Up to two uppercase initials from a label (e.g. "Icon Studio" -> "IS"). */
export function monogram(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : (words[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

/** Render a 512x512 SVG icon: a diagonal gradient behind a monogram. */
export function buildIcon(spec: IconSpec): string {
  const [from, to] = gradientFor(spec.seed);
  const text = monogram(spec.label ?? spec.seed);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    `<defs><linearGradient id="bg" x1="0.146" y1="0.854" x2="0.854" y2="0.146"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`,
    '<rect width="512" height="512" fill="url(#bg)"/>',
    `<text x="256" y="256" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="240" font-weight="700" text-anchor="middle" dominant-baseline="central">${text}</text>`,
    "</svg>",
  ].join("");
}

export default {
  name: "@brika/plugin-icon",
  tools: {
    "generate-icon": (spec: IconSpec) => buildIcon(spec),
  },
};
