import { $ } from "bun";
import { parseBlame, withBlame } from "./core/blame";
import { KINDS } from "./core/kinds";
import { parseLine } from "./core/parse";
import type { BlameInfo, Marker, MarkerKindSpec, ScanResult } from "./core/types";

/**
 * File-system scanner: finds every marker tracked or untracked in the repo. It
 * uses `git grep` as a fast coarse filter (it respects `.gitignore` and includes
 * untracked files), then hands each candidate line to the pure parser, which
 * makes the real decision. The grep step is a port so the scan is unit-testable
 * with a canned set of lines and no git.
 */

/**
 * Runs the coarse search. Returns raw `git grep -n` lines (`path:lineno:content`).
 * Injectable so tests can drive the parser without a repository.
 */
export type GrepPort = (
  terms: readonly string[],
  pathspecs: readonly string[],
) => Promise<string[]>;

const gitGrep: GrepPort = async (terms, pathspecs) => {
  const termArgs = terms.flatMap((term) => ["-e", term]);
  const result = await $`git grep -n --untracked -I ${termArgs} -- ${pathspecs}`.nothrow().quiet();
  return result.stdout.toString().trim().split("\n").filter(Boolean);
};

/** The coarse search term for a kind: its `@tag`. */
function termFor(kind: MarkerKindSpec): string {
  return `@${kind.name}`;
}

/** Pathspecs limiting the search to source, minus the engine and per-kind ignores. */
function pathspecsFor(kinds: readonly MarkerKindSpec[]): string[] {
  const ignores = kinds.flatMap((kind) => kind.ignore);
  return [
    "*.ts",
    "*.tsx",
    ":(exclude)**/node_modules/**",
    // The engine's own sources hold the kind names and test fixtures, which
    // would all read as self-matches.
    ":(exclude)packages/markers/**",
    ...ignores.map((glob) => `:(exclude)${glob}`),
  ];
}

/** Split a `git grep -n` line into `(path, lineNumber, content)`. */
function splitGrepLine(line: string): { file: string; line: number; content: string } | null {
  const first = line.indexOf(":");
  const second = line.indexOf(":", first + 1);
  if (first < 0 || second < 0) return null;
  const lineNumber = Number(line.slice(first + 1, second));
  if (!Number.isInteger(lineNumber)) return null;
  return { file: line.slice(0, first), line: lineNumber, content: line.slice(second + 1) };
}

/** Tally markers by kind for the report header. */
function countByKind(markers: readonly Marker[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const marker of markers) counts[marker.kind] = (counts[marker.kind] ?? 0) + 1;
  return counts;
}

export interface ScanOptions {
  /** Override the kinds to scan for (defaults to every registered kind). */
  readonly kinds?: readonly MarkerKindSpec[];
  /** Override the coarse search (defaults to `git grep`); used in tests. */
  readonly grep?: GrepPort;
}

/** Scan the repository and return every marker with per-kind counts. */
export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const kinds = options.kinds ?? KINDS;
  const grep = options.grep ?? gitGrep;
  const terms = [...new Set(kinds.map((kind) => termFor(kind)))];
  const lines = await grep(terms, pathspecsFor(kinds));

  const markers: Marker[] = [];
  for (const line of lines) {
    const split = splitGrepLine(line);
    if (split === null) continue;
    markers.push(...parseLine(split.file, split.line, split.content, kinds));
  }
  markers.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { markers, counts: countByKind(markers) };
}

/**
 * Runs `git blame --line-porcelain` for the given lines of one file. Injectable
 * so the enrichment is unit-testable without a repository.
 */
export type BlamePort = (file: string, lines: readonly number[]) => Promise<string>;

const gitBlame: BlamePort = async (file, lines) => {
  const ranges = lines.flatMap((line) => ["-L", `${line},${line}`]);
  const result = await $`git blame --line-porcelain ${ranges} -- ${file}`.nothrow().quiet();
  return result.stdout.toString();
};

/** Attach `git blame` author + date to each marker (one blame call per file). */
export async function blameMarkers(
  markers: readonly Marker[],
  options: { readonly blame?: BlamePort } = {},
): Promise<Marker[]> {
  const blame = options.blame ?? gitBlame;
  const linesByFile = new Map<string, number[]>();
  for (const marker of markers) {
    const lines = linesByFile.get(marker.file) ?? [];
    lines.push(marker.line);
    linesByFile.set(marker.file, lines);
  }
  const blameByFile = new Map<string, Map<number, BlameInfo>>();
  await Promise.all(
    [...linesByFile].map(async ([file, lines]) => {
      blameByFile.set(file, parseBlame(await blame(file, lines)));
    }),
  );
  return withBlame(markers, blameByFile);
}
