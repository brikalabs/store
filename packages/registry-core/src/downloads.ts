/**
 * Download statistics: the install signal. Counts live as one row per
 * (package, day-bucket) in storage; this is the pure aggregation over those
 * rows, kept in the domain core so the registry app only owns the D1 IO.
 */

export interface DailyDownloads {
  /** Unix epoch day number (`epochMs / 86_400_000`, floored). */
  readonly day: number;
  readonly count: number;
}

export interface DownloadStats {
  /** All-time installs (sum across every day). */
  readonly total: number;
  /** Installs in the trailing 7-day window (including today). */
  readonly weekly: number;
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

/**
 * The per-day install counts for the trailing `days` window, oldest day first
 * and zero-filled for days with no installs. Drives the sidebar download
 * sparkline. Rows outside the window are ignored.
 */
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
