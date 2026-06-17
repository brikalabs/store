import { KINDS } from "./kinds";
import type { Marker, MarkerKindSpec } from "./types";

/**
 * Pure marker parser: given a line of source, return the markers on it. No file
 * system, no git, no editor: it turns text into {@link Marker}s and nothing
 * else, so it is trivially unit-testable and is shared verbatim by the CLI
 * scanner and the VSCode extension.
 *
 * A marker is a `// @kind: reason` comment (see docs/CONVENTIONS.md). The tag may
 * sit in a line comment, a block comment, or a JSDoc continuation line.
 */

function escapeRe(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** A `// @name: reason` annotation living inside a comment. */
function commentMarker(raw: string, kind: MarkerKindSpec): Marker | null {
  // The trailing `\b` rejects a longer word (so `@mock` matches, `@mockup` does
  // not); scan every occurrence so a valid tag is not hidden by an earlier miss.
  const re = new RegExp(String.raw`@${escapeRe(kind.name)}\b`, "g");
  let match = re.exec(raw);
  while (match !== null) {
    const at = match.index;
    const before = raw.slice(0, at);
    const inComment =
      before.includes("//") || before.includes("/*") || before.trimStart().startsWith("*");
    if (inComment) {
      const reason = raw
        .slice(at + kind.name.length + 1)
        .replace(/^\s*:?\s*/, "")
        .replace(/\*\/\s*$/, "")
        .trim();
      return {
        kind: kind.name,
        file: "",
        line: 0,
        column: at + 1,
        reason,
        text: raw.trim(),
      };
    }
    match = re.exec(raw);
  }
  return null;
}

/** Parse one source line into zero or more markers, stamped with its location. */
export function parseLine(
  file: string,
  line: number,
  raw: string,
  kinds: readonly MarkerKindSpec[] = KINDS,
): Marker[] {
  const found: Marker[] = [];
  for (const kind of kinds) {
    const marker = commentMarker(raw, kind);
    if (marker !== null) found.push({ ...marker, file, line });
  }
  return found;
}

/** Parse a whole document (used by the editor for live diagnostics). */
export function parseText(
  file: string,
  text: string,
  kinds: readonly MarkerKindSpec[] = KINDS,
): Marker[] {
  return text.split("\n").flatMap((raw, index) => parseLine(file, index + 1, raw, kinds));
}
