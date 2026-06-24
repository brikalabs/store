import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";
import { makeAdapter, makeDb } from "../test-harness";
import { D1CatalogReader } from "./d1-catalog";

/**
 * D1 adapter tests for the public catalog. The filter/sort logic is the security boundary: a
 * regression must not leak yanked or taken-down versions into the public listing, so each exclusion
 * carries its own case alongside the happy path.
 */

let db: Db;
let reader: D1CatalogReader;
beforeEach(() => {
  db = makeDb();
  reader = makeAdapter(db, D1CatalogReader);
});

/** Seed one package whose `latest` tag points at a single version, with per-case overrides. */
async function seedLatest(opts: {
  name: string;
  scope: string | null;
  version?: string;
  publishedAt?: number;
  yanked?: boolean;
  takedown?: string | null;
}): Promise<void> {
  const version = opts.version ?? "1.0.0";
  // A scope hosts many packages, so shared cases seed it more than once: ignore the second claim.
  if (opts.scope !== null)
    await db.insert(regScopes).values({ scope: opts.scope }).onConflictDoNothing();
  await db.insert(regPackages).values({ name: opts.name, scope: opts.scope });
  await db.insert(regVersions).values({
    name: opts.name,
    version,
    manifest: { name: opts.name, version },
    integrity: "sha512-test",
    shasum: "deadbeef",
    size: 1,
    publishedAt: opts.publishedAt ?? 1_000,
    yanked: opts.yanked ?? false,
    takedown: opts.takedown ?? null,
  });
  await db.insert(regDistTags).values({ name: opts.name, tag: "latest", version });
}

describe("D1CatalogReader", () => {
  test("excludes a package whose latest version is yanked", async () => {
    await seedLatest({ name: "@brika/live", scope: "@brika" });
    await seedLatest({ name: "@brika/gone", scope: "@brika", yanked: true });

    const entries = await reader.list();

    expect(entries.map((e) => e.name)).toEqual(["@brika/live"]);
  });

  test("excludes a package whose latest version is taken down", async () => {
    await seedLatest({ name: "@brika/live", scope: "@brika" });
    await seedLatest({ name: "@brika/banned", scope: "@brika", takedown: "abuse" });

    const entries = await reader.list();

    expect(entries.map((e) => e.name)).toEqual(["@brika/live"]);
  });

  test("sorts entries by publishedAt descending", async () => {
    await seedLatest({ name: "@brika/old", scope: "@brika", publishedAt: 1_000 });
    await seedLatest({ name: "@brika/new", scope: "@brika", publishedAt: 3_000 });
    await seedLatest({ name: "@brika/mid", scope: "@brika", publishedAt: 2_000 });

    const entries = await reader.list();

    expect(entries.map((e) => e.name)).toEqual(["@brika/new", "@brika/mid", "@brika/old"]);
  });

  test("sets publisher.name to the scope display name when it is set", async () => {
    await seedLatest({ name: "@brika/x", scope: "@brika" });
    await db
      .update(regScopes)
      .set({ displayName: "Brika Inc" })
      .where(eq(regScopes.scope, "@brika"));

    const [entry] = await reader.list();

    expect(entry?.publisher).toEqual({ id: "@brika", name: "Brika Inc", verified: true });
  });

  test("falls back publisher.name to the scope id when the display name is null", async () => {
    await seedLatest({ name: "@brika/x", scope: "@brika" });

    const [entry] = await reader.list();

    expect(entry?.publisher).toEqual({ id: "@brika", name: "@brika", verified: true });
  });

  test("returns publisher undefined when the package has no scope (left-join miss)", async () => {
    await seedLatest({ name: "orphan", scope: null });

    const [entry] = await reader.list();

    expect(entry?.name).toBe("orphan");
    expect(entry?.publisher).toBeUndefined();
  });
});
