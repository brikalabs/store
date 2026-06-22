/**
 * Levenshtein edit distance between two strings: the minimum number of
 * single-character insertions, deletions, or substitutions to turn `a` into `b`.
 * Uses a single rolling row so it stays O(min length) in memory.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // One rolling row keeps memory at O(b.length); `diagonal` carries the pre-overwrite `row[j]`. Every
  // index stays in range, so the `?? 0` reads satisfy `noUncheckedIndexedAccess` (the linter forbids `!`).
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1; // delete, insert, substitute
      row[j] = Math.min((row[j - 1] ?? 0) + 1, above + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

/**
 * Pick the candidate closest to `input` for a "did you mean?" hint, or `undefined` when nothing is
 * near enough. The threshold scales with input length, so unrelated names aren't suggested.
 */
export function suggestCommand(input: string, candidates: Iterable<string>): string | undefined {
  if (!input) return undefined;
  const threshold = Math.max(1, Math.floor(input.length / 3) + 1);

  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = editDistance(input, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= threshold ? best : undefined;
}
