import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";
import { makeAdapter, makeDb } from "../test-harness";
import { D1MetadataReader } from "./d1-metadata";

/**
 * Unit tests for the D1 metadata reader: the absent-package branch plus the full
 * version/dist-tag assembly, including provenance parsing (valid, null, and a
 * malformed value the schema must `.catch(null)`).
 */

let db: Db;
beforeEach(async () => {
  db = makeDb();
  await db.insert(regScopes).values({ scope: "@brika", displayName: "Brika Labs" });
});

describe("D1MetadataReader.getPackage", () => {
  test("returns null for an unknown package", async () => {
    expect(await makeAdapter(db, D1MetadataReader).getPackage("@brika/missing")).toBeNull();
  });

  test("assembles versions, dist-tags, and ISO timestamps", async () => {
    await db
      .insert(regPackages)
      .values({ name: "@brika/x", scope: "@brika", createdAt: "2024-06-01T00:00:00.000Z" });
    await db.insert(regVersions).values([
      {
        name: "@brika/x",
        version: "1.0.0",
        manifest: { name: "@brika/x", version: "1.0.0" },
        integrity: "sha512-a",
        shasum: "aaa",
        size: 10,
        publishedAt: "2024-06-01T01:00:00.000Z",
        deprecated: null,
        yanked: false,
        provenance: { repository: "brika/x", sha: "abc123" },
      },
      {
        name: "@brika/x",
        version: "1.1.0",
        manifest: { name: "@brika/x", version: "1.1.0" },
        integrity: "sha512-b",
        shasum: "bbb",
        size: 20,
        publishedAt: "2024-06-02T00:00:00.000Z",
        deprecated: "use 2.x",
        yanked: true,
        provenance: null,
      },
    ]);
    await db.insert(regDistTags).values([
      { name: "@brika/x", tag: "latest", version: "1.1.0" },
      { name: "@brika/x", tag: "next", version: "1.0.0" },
    ]);

    const record = await makeAdapter(db, D1MetadataReader).getPackage("@brika/x");
    expect(record).not.toBeNull();
    expect(record?.name).toBe("@brika/x");
    expect(record?.createdAt).toBe("2024-06-01T00:00:00.000Z");
    expect(record?.distTags).toEqual({ latest: "1.1.0", next: "1.0.0" });

    const v1 = record?.versions.find((v) => v.version === "1.0.0");
    expect(v1?.provenance).toEqual({ repository: "brika/x", sha: "abc123" });
    expect(v1?.publishedAt).toBe("2024-06-01T01:00:00.000Z");

    const v11 = record?.versions.find((v) => v.version === "1.1.0");
    expect(v11?.deprecated).toBe("use 2.x");
    expect(v11?.yanked).toBe(true);
    expect(v11?.provenance).toBeNull();

    // The publisher is derived from the owning scope: its display name + verified-organization flag.
    expect(record?.publisher).toEqual({ id: "@brika", name: "Brika Labs", verified: false });
  });

  test("coerces a malformed stored provenance to null via .catch(null)", async () => {
    await db.insert(regPackages).values({ name: "@brika/y", scope: "@brika" });
    await db.insert(regVersions).values({
      name: "@brika/y",
      version: "1.0.0",
      manifest: { name: "@brika/y", version: "1.0.0" },
      integrity: "sha512-c",
      shasum: "ccc",
      size: 5,
      // `repository` is required; this row is invalid and must parse to null.
      provenance: { sha: "no-repo" },
    });

    const record = await makeAdapter(db, D1MetadataReader).getPackage("@brika/y");
    expect(record?.versions[0]?.provenance).toBeNull();
  });
});
