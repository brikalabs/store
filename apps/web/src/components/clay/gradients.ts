/**
 * Deterministic "app store" gradients for plugin/author tiles. A stable hash of
 * the seed (plugin name, author id) picks a palette so the same entity always
 * renders the same colorful icon, without storing anything.
 */
export type Gradient = readonly [string, string];

export const GRADIENTS: readonly Gradient[] = [
  ["#7A5CFF", "#635BFF"],
  ["#4F8BD0", "#2F6DA8"],
  ["#19C39C", "#0E8C6F"],
  ["#FF7AA8", "#F2542D"],
  ["#FFB020", "#F2542D"],
  ["#5B8DEF", "#3A5BD9"],
  ["#9B5CF0", "#6D34C9"],
  ["#7C8696", "#525C6B"],
  ["#FF8A8A", "#E25555"],
  ["#A66BFF", "#7A3CF0"],
];

export function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function gradientFor(seed: string): Gradient {
  return GRADIENTS[hashString(seed) % GRADIENTS.length] as Gradient;
}

export function gradientCss(gradient: Gradient, angle = 140): string {
  return `linear-gradient(${angle}deg, ${gradient[0]}, ${gradient[1]})`;
}
