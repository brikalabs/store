/**
 * Marker model. A *marker* is a `// @kind: reason` comment recording a spot in
 * the code that is intentionally incomplete: a limit declared before it is
 * enforced, mock data shown until the real source lands, a planned feature. Every
 * marker carries a required reason so it explains itself in place rather than
 * rotting silently.
 */

/** How loud a marker is. Maps to an editor diagnostic severity. */
export type Severity = "error" | "warning" | "info";

/** Who introduced a marker and when, from `git blame` of its line. */
export interface BlameInfo {
  /** Commit author name (or "Uncommitted" for an unsaved/unstaged line). */
  readonly author: string;
  /** Author timestamp in epoch seconds (0 when uncommitted). */
  readonly authorTime: number;
  /** Short commit hash ("uncommitted" when the line is not yet committed). */
  readonly commit: string;
}

/**
 * A kind of marker (e.g. `mock`, `unenforced`). Kinds are data, not code: adding
 * one is a single entry in the registry, which the parser, CLI, and editor all
 * read.
 */
export interface MarkerKindSpec {
  /** Lowercase identifier used in source (`mock`, `unenforced`, `todo`). */
  readonly name: string;
  /** Human label for reports and the editor tree. */
  readonly title: string;
  /** One line explaining what the kind means. */
  readonly description: string;
  /** Editor/report severity. */
  readonly severity: Severity;
  /** Path globs to skip when scanning (e.g. a file with the tag in prose). */
  readonly ignore: readonly string[];
}

/** A single marker found at a location, with its explanation. */
export interface Marker {
  readonly kind: string;
  /** Repo-relative path. */
  readonly file: string;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column where the `@kind` tag starts. */
  readonly column: number;
  /** Free-text reason. Empty string when the marker omitted one. */
  readonly reason: string;
  /** The trimmed source line the marker was found on. */
  readonly text: string;
  /** Author + date from `git blame`, attached by an enrichment pass; null until then. */
  readonly blame?: BlameInfo | null;
}

/** The outcome of a scan: every marker plus per-kind counts. */
export interface ScanResult {
  readonly markers: readonly Marker[];
  readonly counts: Readonly<Record<string, number>>;
}
