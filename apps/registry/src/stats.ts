import { env } from "cloudflare:workers";
import { getDb } from "@brika/store-db";
import { D1DownloadStore } from "./adapters/d1-downloads";

/** Days of per-day history returned for the sidebar download sparkline. */
const SERIES_DAYS = 30;

/**
 * `GET /-/v1/downloads/:name` - install counts for a single package:
 * `{ name, total, weekly, series }`, where `series` is the trailing 30-day
 * per-day install counts (oldest first) for the detail-page sparkline. The
 * catalog carries total/weekly for listings; this adds the series for one
 * package.
 */
export async function handleDownloads(name: string): Promise<Response> {
  const stats = await new D1DownloadStore(getDb(env.DB)).statsWithSeries(name, SERIES_DAYS);
  return Response.json(
    { name, total: stats.total, weekly: stats.weekly, series: stats.series },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
