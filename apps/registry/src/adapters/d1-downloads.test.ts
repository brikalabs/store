import { beforeEach, describe, expect, test } from "bun:test";
import { type Db, regDownloads, regPackages, regScopes } from "@brika/store-db";
import { and, eq } from "drizzle-orm";
import { makeDb } from "../test-harness";
import { D1DownloadStore } from "./d1-downloads";

/**
 * Unit tests for the D1-backed install-count store. A fixed clock makes the
 * day-bucket math deterministic; the FK to `reg_packages` is satisfied by
 * seeding the package rows first.
 */

const MS_PER_DAY = 86_400_000;
// A clock pinned to the start of epoch day 100 keeps the bucket math obvious.
const TODAY = 100;
const fixedNow = () => TODAY * MS_PER_DAY;

let db: Db;
beforeEach(async () => {
  db = makeDb();
  await db.insert(regScopes).values({ scope: "@brika", ownerId: "octocat" });
  await db.insert(regPackages).values([
    { name: "@brika/a", scope: "@brika" },
    { name: "@brika/b", scope: "@brika" },
  ]);
});

/** Insert a download row for a past or current day relative to TODAY. */
async function seedDownload(name: string, day: number, count: number): Promise<void> {
  await db.insert(regDownloads).values({ name, day, count });
}

describe("D1DownloadStore.record", () => {
  test("inserts today's row with count 1 on first download", async () => {
    const store = new D1DownloadStore(db, fixedNow);
    await store.record("@brika/a");

    const rows = await db
      .select()
      .from(regDownloads)
      .where(and(eq(regDownloads.name, "@brika/a"), eq(regDownloads.day, TODAY)));
    expect(rows[0]?.count).toBe(1);
  });

  test("upserts (increments) today's row on a repeat download", async () => {
    const store = new D1DownloadStore(db, fixedNow);
    await store.record("@brika/a");
    await store.record("@brika/a");
    await store.record("@brika/a");

    const rows = await db
      .select()
      .from(regDownloads)
      .where(and(eq(regDownloads.name, "@brika/a"), eq(regDownloads.day, TODAY)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(3);
  });
});

describe("D1DownloadStore.stats", () => {
  test("zeroed stats for a package with no downloads", async () => {
    const store = new D1DownloadStore(db, fixedNow);
    expect(await store.stats("@brika/a")).toEqual({ total: 0, weekly: 0 });
  });

  test("sums all-time total and the trailing-week window", async () => {
    await seedDownload("@brika/a", TODAY, 5); // in window
    await seedDownload("@brika/a", TODAY - 3, 2); // in window
    await seedDownload("@brika/a", TODAY - 30, 7); // out of window
    const store = new D1DownloadStore(db, fixedNow);

    expect(await store.stats("@brika/a")).toEqual({ total: 14, weekly: 7 });
  });
});

describe("D1DownloadStore.statsWithSeries", () => {
  test("returns stats plus a zero-filled, oldest-first day series", async () => {
    await seedDownload("@brika/a", TODAY, 4);
    await seedDownload("@brika/a", TODAY - 2, 1);
    const store = new D1DownloadStore(db, fixedNow);

    const result = await store.statsWithSeries("@brika/a", 3);
    expect(result.total).toBe(5);
    expect(result.weekly).toBe(5);
    // window is [TODAY-2, TODAY-1, TODAY] -> [1, 0, 4]
    expect(result.series).toEqual([1, 0, 4]);
  });
});

describe("D1DownloadStore.statsFor", () => {
  test("returns an empty map for no names without touching the db", async () => {
    const store = new D1DownloadStore(db, fixedNow);
    expect(await store.statsFor([])).toEqual(new Map());
  });

  test("keys stats by name, zero-filling packages with no rows", async () => {
    await seedDownload("@brika/a", TODAY, 3);
    await seedDownload("@brika/a", TODAY - 10, 9);
    const store = new D1DownloadStore(db, fixedNow);

    const result = await store.statsFor(["@brika/a", "@brika/b"]);
    expect(result.get("@brika/a")).toEqual({ total: 12, weekly: 3 });
    expect(result.get("@brika/b")).toEqual({ total: 0, weekly: 0 });
  });
});
