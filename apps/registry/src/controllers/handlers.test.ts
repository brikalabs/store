import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpError } from "@brika/router";
import { type Db, regDistTags, regPackages, regScopes, regVersions, schema } from "@brika/store-db";
import { transaction } from "@brika/tx";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { D1MetadataWriter } from "../adapters/d1-metadata-writer";
import { R2TarballWriter } from "../adapters/r2-tarball-writer";
import { issueToken } from "../adapters/token";
import { buildServices, type Services } from "../services";
import { handleCatalog } from "./catalog";
import { deprecate, yank } from "./manage";
import { publish } from "./publish";
import { handleDownloads } from "./stats";

/**
 * Integration tests for the registry's HTTP handlers against a real in-memory
 * SQLite (the same drizzle migrations the registry ships) and a fake R2 bucket,
 * so the handlers, adapters, and domain services run end to end without the
 * Cloudflare runtime. Auth uses a seeded registry token (a non-JWT bearer skips
 * the OIDC path with no network). The device handlers read `vars()` (env) so are
 * covered by the `DeviceService` unit test instead.
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../../../packages/db/drizzle");

/** The status a handler yields, whether it returns a Response or throws an HttpError. */
async function statusOf(run: Promise<Response>): Promise<number> {
  try {
    return (await run).status;
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

function makeDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}

/** Minimal in-memory R2 bucket: only the get/put the tarball adapters use. */
function fakeR2(): R2Bucket {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    get: async (key: string) => {
      const bytes = store.get(key);
      return bytes === undefined ? null : { body: new Response(bytes).body };
    },
    put: async (key: string, value: Uint8Array) => {
      store.set(key, value);
      return {};
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
  return bucket as unknown as R2Bucket;
}

function services(db: Db): Services {
  return buildServices(db, fakeR2(), "http://localhost:8787");
}

function post(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/", { method: "POST", headers, body: JSON.stringify(body) });
}

/** Seed a package + its latest version + scope ownership, and an owner token. */
async function seedPackage(db: Db, owner: string): Promise<{ token: string }> {
  await db.insert(regScopes).values({ scope: "@brika", githubOwner: owner });
  await db.insert(regPackages).values({ name: "@brika/x", scope: "@brika" });
  await db.insert(regVersions).values({
    name: "@brika/x",
    version: "1.0.0",
    manifest: { name: "@brika/x", version: "1.0.0" },
    integrity: "sha512-test",
    shasum: "deadbeef",
    size: 1,
  });
  await db.insert(regDistTags).values({ name: "@brika/x", tag: "latest", version: "1.0.0" });
  return { token: await issueToken(db, owner) };
}

let db: Db;
beforeEach(() => {
  db = makeDb();
});

/** A well-formed publish body; the route's `body` schema would accept this. */
const validPublish = {
  name: "@brika/x",
  version: "1.0.0",
  manifest: { name: "@brika/x", version: "1.0.0" },
  tarball: "AAAA",
};

describe("publish (auth + invariant + ownership gates)", () => {
  test("401 without a bearer token", async () => {
    expect(
      await statusOf(publish({ body: validPublish, req: post(validPublish), ctx: services(db) })),
    ).toBe(401);
  });

  test("400 when the manifest name/version does not match the published name/version", async () => {
    const token = await issueToken(db, "octocat");
    const body = { ...validPublish, manifest: { name: "@brika/y", version: "2.0.0" } };
    expect(await statusOf(publish({ body, req: post(body, token), ctx: services(db) }))).toBe(400);
  });

  test("403 when the scope is owned by someone else", async () => {
    // An unclaimed scope is claimable on first publish; ownership only forbids when
    // the scope already belongs to a different owner.
    await db.insert(regScopes).values({ scope: "@brika", githubOwner: "octocat" });
    const token = await issueToken(db, "stranger");
    expect(
      await statusOf(
        publish({ body: validPublish, req: post(validPublish, token), ctx: services(db) }),
      ),
    ).toBe(403);
  });
});

describe("deprecate / yank (ownership-gated mutations)", () => {
  // The `%2f` form arrives as one decoded segment, so `pkg` is the full name.
  const params = { pkg: "@brika/x", version: "1.0.0" };

  test("deprecate sets the version's message for an owner", async () => {
    const { token } = await seedPackage(db, "octocat");
    const res = await deprecate({
      params,
      body: { message: "use @brika/y" },
      req: post(undefined, token),
      ctx: services(db),
    });
    expect(res.status).toBe(200);
    const rows = await db.select().from(regVersions);
    expect(rows[0]?.deprecated).toBe("use @brika/y");
  });

  test("yank hides the version from new installs for an owner", async () => {
    const { token } = await seedPackage(db, "octocat");
    const res = await yank({
      params,
      body: { yanked: true },
      req: post(undefined, token),
      ctx: services(db),
    });
    expect(res.status).toBe(200);
    const rows = await db.select().from(regVersions);
    expect(rows[0]?.yanked).toBe(true);
  });

  test("401 without a token, 403 for a non-owner", async () => {
    await seedPackage(db, "octocat");
    const anon = statusOf(
      deprecate({ params, body: { message: null }, req: post(undefined), ctx: services(db) }),
    );
    expect(await anon).toBe(401);

    const stranger = await issueToken(db, "stranger");
    const forbidden = statusOf(
      deprecate({
        params,
        body: { message: null },
        req: post(undefined, stranger),
        ctx: services(db),
      }),
    );
    expect(await forbidden).toBe(403);
  });
});

describe("handleCatalog", () => {
  test("lists the latest non-yanked version with totals", async () => {
    await seedPackage(db, "octocat");
    const res = await handleCatalog(new Request("http://localhost/-/v1/packages"), services(db));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.packages[0].name).toBe("@brika/x");
  });

  test("free-text search filters by name", async () => {
    await seedPackage(db, "octocat");
    const miss = await handleCatalog(
      new Request("http://localhost/-/v1/packages?text=nomatch"),
      services(db),
    );
    expect((await miss.json()).total).toBe(0);
  });
});

describe("handleDownloads", () => {
  test("returns zeroed stats for a package with no installs", async () => {
    await seedPackage(db, "octocat");
    const res = await handleDownloads("@brika/x", services(db));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ name: "@brika/x", total: 0, weekly: 0 });
  });
});

describe("publish atomicity (commitVersion + transaction)", () => {
  test("commitVersion writes the package, version, and dist-tag together", async () => {
    const meta = new D1MetadataWriter(db);
    await meta.commitVersion({
      scope: "@brika",
      tag: "latest",
      version: {
        name: "@brika/y",
        version: "1.0.0",
        manifest: { name: "@brika/y", version: "1.0.0" },
        integrity: "sha512-x",
        shasum: "abc",
        size: 10,
        publishedAt: "2026-06-16T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        provenance: null,
      },
    });

    expect((await db.select().from(regPackages)).map((r) => r.name)).toContain("@brika/y");
    const versions = await db.select().from(regVersions);
    expect(versions.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0");
    const tags = await db.select().from(regDistTags);
    expect(tags.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0"); // tag moved in the same unit
  });

  test("a tarball put is rolled back (deleted) when the surrounding transaction fails", async () => {
    const store = new Map<string, Uint8Array>();
    const r2 = {
      put: async (key: string, value: Uint8Array) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
    } as unknown as R2Bucket;
    const tarballs = new R2TarballWriter(r2);

    await expect(
      transaction(async () => {
        await tarballs.put("@brika/y/-/y-1.0.0.tgz", new Uint8Array([1, 2, 3]));
        expect(store.size).toBe(1); // staged
        throw new Error("metadata commit failed");
      }),
    ).rejects.toThrow("metadata commit failed");

    expect(store.size).toBe(0); // compensated: no orphan tarball
  });

  test("a tarball put outside a transaction is a plain write (no rollback)", async () => {
    const store = new Map<string, Uint8Array>();
    const r2 = {
      put: async (key: string, value: Uint8Array) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
    } as unknown as R2Bucket;
    await new R2TarballWriter(r2).put("k", new Uint8Array([1]));
    expect(store.size).toBe(1);
  });
});
