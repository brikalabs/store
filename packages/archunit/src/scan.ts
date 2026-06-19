/** Filesystem scanning + per-file parsing, memoized for a process. */

import { readFileSync } from "node:fs";
import { Glob } from "bun";
import { classNames, specifiers, stripComments } from "./source";

// Process-level memoization. Rules overlap (e.g. `packages/*/src` and `packages/*-core/src`
// both cover registry-core), so without this the same files would be globbed, read, and
// parsed several times. Source is stable for a run, so caching by pattern/path is safe.
const globCache = new Map<string, Glob>();
const scanCache = new Map<string, string[]>();
const sourceCache = new Map<string, string>();
const importsCache = new Map<string, string[]>();
const classesCache = new Map<string, string[]>();

function compiledGlob(pattern: string): Glob {
  const cached = globCache.get(pattern);
  if (cached !== undefined) return cached;
  const glob = new Glob(pattern);
  globCache.set(pattern, glob);
  return glob;
}

/** Whether a repo-relative path matches a glob (compiled once per pattern). */
export function matchesGlob(pattern: string, rel: string): boolean {
  return compiledGlob(pattern).match(rel);
}

/** The repo-relative paths under `root` matching `pattern` (scanned once per pattern). */
export function scan(root: string, pattern: string): string[] {
  const key = `${root} ${pattern}`;
  const cached = scanCache.get(key);
  if (cached !== undefined) return cached;
  const matches = [...compiledGlob(pattern).scanSync(root)];
  scanCache.set(key, matches);
  return matches;
}

/** Read + strip comments for a file, once per process (the basis for the parses below). */
function strippedSource(absolutePath: string): string {
  const cached = sourceCache.get(absolutePath);
  if (cached !== undefined) return cached;
  const stripped = stripComments(readFileSync(absolutePath, "utf8"));
  sourceCache.set(absolutePath, stripped);
  return stripped;
}

/** The module specifiers a file imports/exports (comments already stripped). */
export function importsOf(absolutePath: string): string[] {
  const cached = importsCache.get(absolutePath);
  if (cached !== undefined) return cached;
  const found = specifiers(strippedSource(absolutePath));
  importsCache.set(absolutePath, found);
  return found;
}

/** The class names a file declares (comments already stripped). */
export function classesOf(absolutePath: string): string[] {
  const cached = classesCache.get(absolutePath);
  if (cached !== undefined) return cached;
  const found = classNames(strippedSource(absolutePath));
  classesCache.set(absolutePath, found);
  return found;
}

/**
 * Expand a directory/package-shaped pattern to all the TS sources under it, so rules can
 * be written by folder: `filesMatching("packages/*-core/src")` instead of
 * `"packages/*-core/src/**\/*.ts"`. A pattern that already targets files (ends in
 * `.ts`/`.tsx`, or contains an explicit `*.ext` / brace glob) is left as-is.
 */
export function toFileGlob(pattern: string): string {
  if (/\.(ts|tsx)$/.test(pattern) || /\*\.[a-z{]/.test(pattern)) return pattern;
  return `${pattern.replace(/\/+$/, "")}/**/*.{ts,tsx}`;
}
