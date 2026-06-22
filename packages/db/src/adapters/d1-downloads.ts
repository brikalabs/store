import { inject, injectOr, token } from "@brika/di";
import {
  type DownloadStats,
  type DownloadStore,
  downloadSeries,
  epochDay,
  summarizeDownloads,
} from "@brika/registry-core";
import { eq, inArray, sql } from "drizzle-orm";
import { Db } from "../client";
import { regDownloads } from "../schema";

/** Optional clock seam (unix ms) for deterministic tests; defaults to `Date.now`. */
export const DownloadsClock = token<() => number>("DownloadsClock");

/** D1 {@link DownloadStore}: per-day `reg_downloads` counts, aggregated into all-time + trailing-week totals. */
export class D1DownloadStore implements DownloadStore {
  readonly #db = inject(Db);
  readonly #now = injectOr(DownloadsClock, Date.now);

  /** Increment today's count for a package (idempotent per day via upsert). */
  async record(name: string): Promise<void> {
    const day = epochDay(this.#now());
    await this.#db
      .insert(regDownloads)
      .values({ name, day, count: 1 })
      .onConflictDoUpdate({
        target: [regDownloads.name, regDownloads.day],
        set: { count: sql`${regDownloads.count} + 1` },
      });
  }

  /** All-time + trailing-week installs for one package. */
  async stats(name: string): Promise<DownloadStats> {
    const rows = await this.#db
      .select({ day: regDownloads.day, count: regDownloads.count })
      .from(regDownloads)
      .where(eq(regDownloads.name, name));
    return summarizeDownloads(rows, epochDay(this.#now()));
  }

  /** Stats plus the per-day series for the trailing `days`-day sparkline window. */
  async statsWithSeries(name: string, days: number): Promise<DownloadStats & { series: number[] }> {
    const rows = await this.#db
      .select({ day: regDownloads.day, count: regDownloads.count })
      .from(regDownloads)
      .where(eq(regDownloads.name, name));
    const today = epochDay(this.#now());
    return { ...summarizeDownloads(rows, today), series: downloadSeries(rows, today, days) };
  }

  /** Install stats for a set of packages, keyed by name (absent -> zero). */
  async statsFor(names: readonly string[]): Promise<Map<string, DownloadStats>> {
    const result = new Map<string, DownloadStats>();
    if (names.length === 0) return result;
    const rows = await this.#db
      .select({ name: regDownloads.name, day: regDownloads.day, count: regDownloads.count })
      .from(regDownloads)
      .where(inArray(regDownloads.name, [...names]));

    const byName = new Map<string, { day: number; count: number }[]>();
    for (const row of rows) {
      const list = byName.get(row.name) ?? [];
      list.push({ day: row.day, count: row.count });
      byName.set(row.name, list);
    }
    const today = epochDay(this.#now());
    for (const name of names) {
      result.set(name, summarizeDownloads(byName.get(name) ?? [], today));
    }
    return result;
  }
}

export { ZERO_DOWNLOADS } from "@brika/registry-core";
