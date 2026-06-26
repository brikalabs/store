/**
 * Download statistics. Counts live as one row per (package, day-bucket) in storage; this is the
 * pure aggregation over those rows, with the app owning the D1 IO.
 */

export interface DailyDownloads {
  readonly day: number; // epochMs / 86_400_000, floored
  readonly count: number;
}

export interface DownloadStats {
  /** All-time installs. */
  readonly total: number;
  /** Installs in the trailing 7-day window (including today). */
  readonly weekly: number;
}

/** Persistence port for install counts: record a download and read aggregated stats. */
export interface DownloadStore {
  /** Increment today's count for a package. */
  record(name: string): Promise<void>;
  /** All-time + trailing-week installs for one package. */
  stats(name: string): Promise<DownloadStats>;
  /** Stats plus the per-day series for a trailing `days`-day sparkline window. */
  statsWithSeries(name: string, days: number): Promise<DownloadStats & { series: number[] }>;
  /** Install stats for a set of packages, keyed by name (absent -> zero). */
  statsFor(names: readonly string[]): Promise<Map<string, DownloadStats>>;
}

/** Trailing window, in days, the `weekly` figure covers. */
export const DOWNLOAD_WINDOW_DAYS = 7;

/** The day-bucket an instant falls in (UTC), used as the `reg_downloads` key. */
export function epochDay(epochMs: number): number {
  return Math.floor(epochMs / 86_400_000);
}

/** Aggregate per-day counts into all-time and trailing-week totals. */
export function summarizeDownloads(
  rows: ReadonlyArray<DailyDownloads>,
  todayDay: number,
): DownloadStats {
  const cutoff = todayDay - (DOWNLOAD_WINDOW_DAYS - 1);
  let total = 0;
  let weekly = 0;
  for (const row of rows) {
    total += row.count;
    if (row.day >= cutoff) weekly += row.count;
  }
  return { total, weekly };
}

/** Per-day install counts for the trailing `days` window, oldest day first and zero-filled. */
export function downloadSeries(
  rows: ReadonlyArray<DailyDownloads>,
  todayDay: number,
  days: number,
): number[] {
  const start = todayDay - (days - 1);
  const series = new Array<number>(Math.max(days, 0)).fill(0);
  for (const row of rows) {
    const index = row.day - start;
    if (index >= 0 && index < series.length) series[index] = (series[index] ?? 0) + row.count;
  }
  return series;
}

export const ZERO_DOWNLOADS: DownloadStats = { total: 0, weekly: 0 };
