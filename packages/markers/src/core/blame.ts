import type { BlameInfo, Marker } from "./types";

/**
 * Pure `git blame` helpers: turn porcelain output into per-line {@link BlameInfo}
 * and attach it to markers. No git here (that is an adapter in `../scan.ts` for
 * the CLI and in the extension); this only parses, so it is unit-testable.
 */

const UNCOMMITTED = "0".repeat(40);

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Locale-aware local date + time for a blame timestamp (epoch seconds). */
export function formatTimestamp(epochSeconds: number): string {
  return TIMESTAMP_FORMAT.format(new Date(epochSeconds * 1000));
}

function blameInfo(commit: string, author: string, authorTime: number): BlameInfo {
  if (commit === UNCOMMITTED)
    return { author: "Uncommitted", authorTime: 0, commit: "uncommitted" };
  return { author: author || "Unknown", authorTime, commit: commit.slice(0, 8) };
}

/** Parse `git blame --line-porcelain` output into a final-line -> blame map. */
export function parseBlame(porcelain: string): Map<number, BlameInfo> {
  const byLine = new Map<number, BlameInfo>();
  let commit = "";
  let author = "";
  let authorTime = 0;
  let finalLine = 0;
  for (const line of porcelain.split("\n")) {
    const header = /^([0-9a-f]{40}) \d+ (\d+)/.exec(line);
    if (header !== null) {
      commit = header[1] ?? "";
      finalLine = Number(header[2]);
      author = "";
      authorTime = 0;
      continue;
    }
    if (line.startsWith("author ")) {
      author = line.slice("author ".length);
      continue;
    }
    if (line.startsWith("author-time ")) {
      authorTime = Number(line.slice("author-time ".length));
      continue;
    }
    if (line.startsWith("\t")) byLine.set(finalLine, blameInfo(commit, author, authorTime));
  }
  return byLine;
}

/** Attach blame to each marker from a per-file `line -> BlameInfo` map (pure). */
export function withBlame(
  markers: readonly Marker[],
  blameByFile: ReadonlyMap<string, ReadonlyMap<number, BlameInfo>>,
): Marker[] {
  return markers.map((marker) => ({
    ...marker,
    blame: blameByFile.get(marker.file)?.get(marker.line) ?? null,
  }));
}
