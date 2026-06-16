import { env } from "cloudflare:workers";
import { getDb } from "@brika/store-db";
import { D1DownloadStore } from "./adapters/d1-downloads";

/**
 * `GET /-/v1/downloads/:name` - install counts for a single package:
 * `{ name, total, weekly }`. The catalog carries the same figures for listings;
 * this serves the detail page (and any client) a fresh, per-package read.
 */
export async function handleDownloads(name: string): Promise<Response> {
  const stats = await new D1DownloadStore(getDb(env.DB)).stats(name);
  return Response.json(
    { name, total: stats.total, weekly: stats.weekly },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
