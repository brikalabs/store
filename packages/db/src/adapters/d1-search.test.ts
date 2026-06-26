import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SearchOptions } from "@brika/registry-core";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "../client";
import { regDistTags, regDownloads, regPackages, regScopes, regVersions, schema } from "../index";
import { makeAdapter, makeDb } from "../test-harness";
import { D1MetadataWriter } from "./d1-metadata-writer";
import { D1SearchReader } from "./d1-search";

/**
 * Search adapter tests. The fixtures are published through the real {@link D1MetadataWriter}, so the
 * `reg_search`/`reg_keywords`/FTS projection is built exactly as production builds it; the negative
 * cases prove a yank drops a package from the index (not just from the dist-tag).
 */

let db: Db;
let writer: D1MetadataWriter;
let reader: D1SearchReader;
beforeEach(async () => {
  db = makeDb();
  writer = makeAdapter(db, D1MetadataWriter);
  reader = makeAdapter(db, D1SearchReader);
  await publish("@brika/maps", {
    displayName: "Maps Pro",
    description: "interactive maps and geocoding",
    keywords: ["maps", "geo"],
    tools: [{}, {}],
    pages: [{}],
  });
  await publish("@brika/charts", {
    displayName: "Charts",
    description: "beautiful data charts",
    keywords: ["charts", "geo"],
    blocks: [{}],
  });
  await publish("@brika/auth", {
    displayName: "Auth Kit",
    description: "user authentication and security",
    keywords: ["auth", "security"],
    tools: [{}],
  });
});

async function publish(
  name: string,
  fields: Record<string, unknown>,
  version = "1.0.0",
): Promise<void> {
  await writer.commitVersion({
    scope: "@brika",
    tag: "latest",
    version: {
      name,
      version,
      manifest: { name, version, engines: { brika: "^1.0.0" }, ...fields },
      integrity: "sha512-x",
      shasum: "abc",
      size: 10,
      publishedAt: "2026-06-16T00:00:00.000Z",
      deprecated: null,
      yanked: false,
      provenance: null,
    },
  });
}

function search(options: Partial<SearchOptions> = {}) {
  return reader.search({ sort: [{ field: "recent" }], limit: 20, offset: 0, ...options });
}

const names = (result: { entries: { name: string }[] }) => result.entries.map((e) => e.name).sort();

describe("D1SearchReader free-text (FTS)", () => {
  test("matches name, display name, description and keywords by prefix", async () => {
    expect(names(await search({ q: "map" }))).toEqual(["@brika/maps"]);
    expect(names(await search({ q: "authentication" }))).toEqual(["@brika/auth"]);
    expect(names(await search({ q: "geocod" }))).toEqual(["@brika/maps"]);
  });

  test("a query with no matches returns nothing (and zero total)", async () => {
    const result = await search({ q: "nonexistent" });
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("D1SearchReader filters", () => {
  test("a single tag matches every package carrying it", async () => {
    expect(names(await search({ tags: ["geo"] }))).toEqual(["@brika/charts", "@brika/maps"]);
  });

  test("multiple tags are AND-matched", async () => {
    expect(names(await search({ tags: ["geo", "maps"] }))).toEqual(["@brika/maps"]);
  });

  test("tag matching is case-insensitive", async () => {
    expect(names(await search({ tags: ["GEO"] }))).toEqual(["@brika/charts", "@brika/maps"]);
  });

  test("a capability filter keeps only packages declaring at least one", async () => {
    expect(names(await search({ capabilities: ["tools"] }))).toEqual([
      "@brika/auth",
      "@brika/maps",
    ]);
    expect(names(await search({ capabilities: ["blocks"] }))).toEqual(["@brika/charts"]);
  });

  test("multiple capabilities are OR-matched", async () => {
    expect(names(await search({ capabilities: ["blocks", "pages"] }))).toEqual([
      "@brika/charts",
      "@brika/maps",
    ]);
  });

  test("filters by the operator verified flag", async () => {
    await writer.setVerified("@brika/maps", true);
    await writer.setVerified("@brika/auth", true);
    expect(names(await search({ verified: true }))).toEqual(["@brika/auth", "@brika/maps"]);
    expect(names(await search({ verified: false }))).toEqual(["@brika/charts"]);
    expect(names(await search({}))).toEqual(["@brika/auth", "@brika/charts", "@brika/maps"]);
  });
});

describe("D1SearchReader sort + pagination", () => {
  test("sorts by display name", async () => {
    const result = await search({ sort: [{ field: "name" }] });
    expect(result.entries.map((e) => e.name)).toEqual([
      "@brika/auth",
      "@brika/charts",
      "@brika/maps",
    ]);
  });

  test("sorts by all-time downloads", async () => {
    await db.insert(regDownloads).values([
      { name: "@brika/maps", day: 20_000, count: 100 },
      { name: "@brika/auth", day: 20_000, count: 10 },
    ]);
    const result = await search({ sort: [{ field: "downloads" }] });
    expect(result.entries.map((e) => e.name)).toEqual([
      "@brika/maps",
      "@brika/auth",
      "@brika/charts",
    ]);
  });

  test("honours the sort direction", async () => {
    const result = await search({ sort: [{ field: "name", direction: "desc" }] });
    expect(result.entries.map((e) => e.name)).toEqual([
      "@brika/maps",
      "@brika/charts",
      "@brika/auth",
    ]);
  });

  test("applies multiple sort terms in order", async () => {
    await db.insert(regDownloads).values([
      { name: "@brika/maps", day: 20_000, count: 100 },
      { name: "@brika/auth", day: 20_000, count: 10 },
      { name: "@brika/charts", day: 20_000, count: 10 },
    ]);
    // downloads desc, then name asc breaks the auth/charts tie (both 10 installs).
    const result = await search({
      sort: [{ field: "downloads", direction: "desc" }, { field: "name" }],
    });
    expect(result.entries.map((e) => e.name)).toEqual([
      "@brika/maps",
      "@brika/auth",
      "@brika/charts",
    ]);
  });

  test("paginates with a stable total across pages", async () => {
    const first = await search({ sort: [{ field: "name" }], limit: 2, offset: 0 });
    const second = await search({ sort: [{ field: "name" }], limit: 2, offset: 2 });
    expect(first.entries).toHaveLength(2);
    expect(second.entries).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
  });
});

describe("D1SearchReader index maintenance", () => {
  test("yanking a package's only version drops it from search", async () => {
    await writer.setYanked("@brika/maps", "1.0.0", true);
    expect(names(await search({ q: "map" }))).toEqual([]);
    expect(names(await search({ tags: ["geo"] }))).toEqual(["@brika/charts"]);
  });

  test("an operator takedown drops the package from search (never leaks)", async () => {
    await writer.setTakedown("@brika/maps", "1.0.0", "dmca");
    expect(names(await search({ q: "map" }))).toEqual([]);
    expect(names(await search({ capabilities: ["tools"] }))).toEqual(["@brika/auth"]);
  });

  test("reflects the operator-set 'approved by Brika' flag on the catalog entry", async () => {
    const find = async () =>
      (await search({ q: "map" })).entries.find((e) => e.name === "@brika/maps");
    expect((await find())?.verified).toBe(false); // unapproved by default
    await writer.setVerified("@brika/maps", true);
    expect((await find())?.verified).toBe(true);
    await writer.setVerified("@brika/maps", false);
    expect((await find())?.verified).toBe(false);
  });

  test("re-publishing updates the indexed keywords and capabilities", async () => {
    await publish(
      "@brika/maps",
      { displayName: "Maps Pro", keywords: ["cartography"], pages: [{}] },
      "2.0.0",
    );
    expect(names(await search({ tags: ["maps"] }))).toEqual([]);
    expect(names(await search({ tags: ["cartography"] }))).toEqual(["@brika/maps"]);
    expect(names(await search({ capabilities: ["tools"] }))).toEqual(["@brika/auth"]);
  });
});

describe("operator takedown withdraws packages from search", () => {
  test("a whole-package takedown drops it from results and the total", async () => {
    await writer.setPackageTakedown("@brika/maps", "policy violation");
    const result = await search();
    expect(names(result)).toEqual(["@brika/auth", "@brika/charts"]);
    expect(result.total).toBe(2);
  });

  test("clearing the package takedown returns it to search", async () => {
    await writer.setPackageTakedown("@brika/maps", "oops");
    await writer.setPackageTakedown("@brika/maps", null);
    expect(names(await search())).toContain("@brika/maps");
  });

  test("a taken-down scope hides every package published under it", async () => {
    // The seed publishes under @brika but creates no scope row (claim does); add one, taken down.
    await db.insert(regScopes).values({ scope: "@brika", takedown: "scope squatting" });
    const result = await search();
    expect(names(result)).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("an ACTIVE scope row leaves its packages searchable (the left join + isNull holds)", async () => {
    await db.insert(regScopes).values({ scope: "@brika", takedown: null });
    expect(names(await search())).toEqual(["@brika/auth", "@brika/charts", "@brika/maps"]);
  });
});

describe("0001 migration backfill", () => {
  const DRIZZLE_DIR = join(import.meta.dir, "../../drizzle");
  const apply = (sqlite: Database, file: string) => {
    for (const statement of readFileSync(join(DRIZZLE_DIR, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  };

  test("projects pre-existing latest versions into the search index", async () => {
    const sqlite = new Database(":memory:");
    apply(sqlite, "0000_tough_rawhide_kid.sql");
    apply(sqlite, "0002_verified.sql"); // before the seed: drizzle inlines the verified default on insert
    apply(sqlite, "0003_scope_verified.sql"); // the search reader joins reg_scopes.verified (the org badge)
    apply(sqlite, "0004_package_takedown.sql"); // the current search reader filters on reg_packages.takedown
    // Seed legacy rows through Drizzle (so the manifest JSON is serialized correctly) before the
    // search migration runs, then apply it and assert the backfill projected them.
    const db = drizzle(sqlite, { schema }) as unknown as Db;
    await db
      .insert(regPackages)
      .values([{ name: "@brika/legacy", createdAt: 1_700_000 }, { name: "@brika/hidden" }]);
    await db.insert(regVersions).values([
      {
        name: "@brika/legacy",
        version: "1.0.0",
        manifest: {
          name: "@brika/legacy",
          displayName: "Legacy Tool",
          description: "the old reliable",
          keywords: ["Old", "Stable"],
          tools: [{}, {}, {}],
        },
        integrity: "i",
        shasum: "s",
        size: 1,
        publishedAt: "2024-06-01T01:00:00.000Z",
      },
      // A fully yanked package must never be backfilled into the public index.
      {
        name: "@brika/hidden",
        version: "1.0.0",
        manifest: {},
        integrity: "i",
        shasum: "s",
        size: 1,
        yanked: true,
      },
    ]);
    await db.insert(regDistTags).values([
      { name: "@brika/legacy", tag: "latest", version: "1.0.0" },
      { name: "@brika/hidden", tag: "latest", version: "1.0.0" },
    ]);

    apply(sqlite, "0001_search.sql");

    const reader = makeAdapter(db, D1SearchReader);
    expect(
      (
        await reader.search({ q: "reliable", sort: [{ field: "relevance" }], limit: 20, offset: 0 })
      ).entries.map((e) => e.name),
    ).toEqual(["@brika/legacy"]);
    // keywords were lowercased on backfill, so a lowercase tag filter matches.
    expect(
      (
        await reader.search({ tags: ["stable"], sort: [{ field: "recent" }], limit: 20, offset: 0 })
      ).entries.map((e) => e.name),
    ).toEqual(["@brika/legacy"]);
    expect(
      (
        await reader.search({
          capabilities: ["tools"],
          sort: [{ field: "recent" }],
          limit: 20,
          offset: 0,
        })
      ).entries.map((e) => e.name),
    ).toEqual(["@brika/legacy"]);
    // The yanked package never entered the index.
    expect(
      (await reader.search({ sort: [{ field: "recent" }], limit: 20, offset: 0 })).entries.map(
        (e) => e.name,
      ),
    ).toEqual(["@brika/legacy"]);
  });
});
