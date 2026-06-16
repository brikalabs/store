/** Compact a count, e.g. 1234 -> "1.2k", 2_500_000 -> "2.5M". */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** Format a byte count, e.g. 10752 -> "10.5 kB", 260096 -> "254 kB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 100 ? kb.toFixed(1) : Math.round(kb)} kB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Format an ISO timestamp as a short date, or empty string when absent. */
export function formatDate(iso: string | undefined): string {
  if (iso === undefined) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
