import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";
import { makeAdapter, makeDb } from "../test-harness";
import { D1MetadataReader } from "./d1-metadata";
import { D1MetadataWriter } from "./d1-metadata-writer";

/**
 * Yank/takedown must keep the `latest` dist-tag pointing at the newest installable version,
 * never at a hidden one: otherwise `bun add` resolves a version absent from the packument and
 * the storefront catalog hides the whole package even when older versions still install. When
 * every version is hidden the tag is removed (unlisted), and un-yanking restores it.
 */

const NAME = "@brika/x";

async function latestTag(db: Db): Promise<string | undefined> {
  const record = await makeAdapter(db, D1MetadataReader).getPackage(NAME);
  return record?.distTags.latest;
}

let db: Db;
let writer: D1MetadataWriter;
beforeEach(async () => {
  db = makeDb();
  writer = makeAdapter(db, D1MetadataWriter);
  await db.insert(regScopes).values({ scope: "@brika", displayName: "Brika Labs" });
  await db.insert(regPackages).values({ name: NAME, scope: "@brika", createdAt: 1_700_000 });
  await db.insert(regVersions).values([
    {
      name: NAME,
      version: "1.0.0",
      manifest: {},
      integrity: "sha512-a",
      shasum: "a",
      size: 1,
      publishedAt: 1_700_100,
      yanked: false,
    },
    {
      name: NAME,
      version: "2.0.0",
      manifest: {},
      integrity: "sha512-b",
      shasum: "b",
      size: 1,
      publishedAt: 1_700_200,
      yanked: false,
    },
  ]);
  await db.insert(regDistTags).values({ name: NAME, tag: "latest", version: "2.0.0" });
});

describe("D1MetadataWriter latest-tag maintenance", () => {
  test("yanking the latest version moves `latest` to the newest installable one", async () => {
    await writer.setYanked(NAME, "2.0.0", true);
    expect(await latestTag(db)).toBe("1.0.0");
  });

  test("yanking every version removes the `latest` tag (unlisted)", async () => {
    await writer.setYanked(NAME, "2.0.0", true);
    await writer.setYanked(NAME, "1.0.0", true);
    expect(await latestTag(db)).toBeUndefined();
  });

  test("un-yanking restores `latest` to the newest installable version", async () => {
    await writer.setYanked(NAME, "2.0.0", true);
    await writer.setYanked(NAME, "1.0.0", true);
    await writer.setYanked(NAME, "2.0.0", false);
    expect(await latestTag(db)).toBe("2.0.0");
  });

  test("an operator takedown of the latest also re-points `latest`", async () => {
    await writer.setTakedown(NAME, "2.0.0", "dmca");
    expect(await latestTag(db)).toBe("1.0.0");
  });

  test("ties on publishedAt resolve deterministically to the higher version", async () => {
    // publishedAt is stored truncated to whole seconds, so a bulk/CI publish can tie. Two more
    // versions share 2.0.0's second; yanking 2.0.0 must pick 1.5.0 (the highest of the tied,
    // still-installable versions), never an arbitrary engine-ordered row.
    await db.insert(regVersions).values([
      {
        name: NAME,
        version: "1.4.0",
        manifest: {},
        integrity: "sha512-c",
        shasum: "c",
        size: 1,
        publishedAt: 1_700_200,
        yanked: false,
      },
      {
        name: NAME,
        version: "1.5.0",
        manifest: {},
        integrity: "sha512-d",
        shasum: "d",
        size: 1,
        publishedAt: 1_700_200,
        yanked: false,
      },
    ]);
    await writer.setYanked(NAME, "2.0.0", true);
    expect(await latestTag(db)).toBe("1.5.0");
  });
});

describe("D1MetadataWriter deletePackage", () => {
  test("removes the package, its versions, and its dist-tags", async () => {
    await writer.deletePackage(NAME);
    expect(await makeAdapter(db, D1MetadataReader).getPackage(NAME)).toBeNull();
    expect(await db.select().from(regVersions).where(eq(regVersions.name, NAME))).toEqual([]);
    expect(await db.select().from(regDistTags).where(eq(regDistTags.name, NAME))).toEqual([]);
    expect(await db.select().from(regPackages).where(eq(regPackages.name, NAME))).toEqual([]);
  });
});

describe("D1MetadataWriter packageExists / createPackage (name reservation)", () => {
  test("packageExists reflects whether the package row is present", async () => {
    expect(await writer.packageExists(NAME)).toBe(true);
    expect(await writer.packageExists("@brika/missing")).toBe(false);
  });

  test("createPackage reserves a name as a version-less row", async () => {
    await writer.createPackage("@brika/reserved", "@brika");
    expect(await writer.packageExists("@brika/reserved")).toBe(true);
    expect(
      await db.select().from(regVersions).where(eq(regVersions.name, "@brika/reserved")),
    ).toEqual([]);
  });
});
