import { inject } from "@brika/di";
import { PKG, packageName } from "@brika/router/npm";
import { controller, route } from "../http/router";
import { Downloads } from "../services";

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
  const stats = await inject(Downloads).statsWithSeries(name, SERIES_DAYS);
  return Response.json(
    { name, total: stats.total, weekly: stats.weekly, series: stats.series },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}

export const statsController = controller({
  name: "stats",
  prefix: "/-/v1",
  routes: [
    route.get({
      path: `/downloads/${PKG}`,
      handler: ({ params }) => handleDownloads(packageName(params)),
    }),
  ],
});
