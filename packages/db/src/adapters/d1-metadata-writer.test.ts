import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";
import { makeDb } from "../test-harness";
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
  const record = await new D1MetadataReader(db).getPackage(NAME);
  return record?.distTags.latest;
}

let db: Db;
let writer: D1MetadataWriter;
beforeEach(async () => {
  db = makeDb();
  writer = new D1MetadataWriter(db);
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
});
