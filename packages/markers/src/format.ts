import { formatTimestamp } from "./core/blame";
import { KINDS } from "./core/kinds";
import type { BlameInfo, MarkerKindSpec, ScanResult, Severity } from "./core/types";

/** Output shapes the CLI can emit. */
export type Format = "human" | "json" | "github";

const SEVERITY_LABEL: Record<Severity, string> = {
  error: "error",
  warning: "warning",
  info: "notice",
};

/** ` (author, Jun 10, 2026, 2:30 PM)` when a marker has been blamed; empty otherwise. */
function blameSuffix(blame: BlameInfo | null | undefined): string {
  if (blame === null || blame === undefined) return "";
  return blame.authorTime > 0
    ? ` (${blame.author}, ${formatTimestamp(blame.authorTime)})`
    : ` (${blame.author})`;
}

/** A one-line summary like `7 markers (unenforced: 6, mock: 1)`. */
function summary(result: ScanResult, kinds: readonly MarkerKindSpec[]): string {
  const total = result.markers.length;
  const breakdown = kinds
    .map((kind) => [kind.name, result.counts[kind.name] ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");
  const noun = total === 1 ? "marker" : "markers";
  return breakdown ? `${total} ${noun} (${breakdown})` : `${total} ${noun}`;
}

/** Grouped, human-readable report. */
function human(result: ScanResult, kinds: readonly MarkerKindSpec[]): string {
  if (result.markers.length === 0) return "No markers found.";
  const lines: string[] = [summary(result, kinds), ""];
  for (const kind of kinds) {
    const group = result.markers.filter((marker) => marker.kind === kind.name);
    if (group.length === 0) continue;
    lines.push(`${kind.title} (${group.length}) - ${kind.description}`);
    for (const marker of group) {
      lines.push(
        `  ${marker.file}:${marker.line}:${marker.column}${blameSuffix(marker.blame)}`,
        `    ${marker.reason || "(no reason given)"}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** GitHub Actions workflow commands; render as annotations on the PR diff. */
function github(result: ScanResult, kinds: readonly MarkerKindSpec[]): string {
  const severityOf = new Map(kinds.map((kind) => [kind.name, kind.severity]));
  return result.markers
    .map((marker) => {
      const level = SEVERITY_LABEL[severityOf.get(marker.kind) ?? "info"];
      const message = `[${marker.kind}] ${marker.reason || "(no reason given)"}`;
      return `::${level} file=${marker.file},line=${marker.line},col=${marker.column}::${message}`;
    })
    .join("\n");
}

/** Render a scan result in the requested format, grouped/coloured by `kinds`. */
export function format(
  result: ScanResult,
  output: Format,
  kinds: readonly MarkerKindSpec[] = KINDS,
): string {
  switch (output) {
    case "json":
      return JSON.stringify(
        { total: result.markers.length, counts: result.counts, markers: result.markers },
        null,
        2,
      );
    case "github":
      return github(result, kinds);
    default:
      return human(result, kinds);
  }
}
