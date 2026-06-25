import { beforeEach, describe, expect, mock, test } from "bun:test";
import { inject, type Provider, provide, runInContext, testBed } from "@brika/di";
import { PublishConfig, PublishService, ResolveService } from "@brika/registry-core";
import { HttpError } from "@brika/router";
import {
  type Db,
  regDistTags,
  regPackages,
  regScopeMembers,
  regScopes,
  regVersions,
} from "@brika/store-db";
import { D1MetadataWriter, issueToken } from "@brika/store-db/adapters";
import { makeAdapter } from "@brika/store-db/test-harness";
import { transaction } from "@brika/tx";
import { eq } from "drizzle-orm";
import { TarballBucket } from "../adapters/r2-tarball";
import { R2TarballWriter } from "../adapters/r2-tarball-writer";
import { provideRegistry } from "../services";
import { fakeR2, makeDb, seedExamplePackage } from "../test-harness";
import { handleSearch } from "./search";
import { handleDownloads } from "./stats";

/**
 * Integration tests for the registry's HTTP handlers against a real in-memory
 * SQLite (the same drizzle migrations the registry ships) and a fake R2 bucket,
 * so the handlers, adapters, and domain services run end to end without the
 * Cloudflare runtime. Auth uses a seeded registry token (a non-JWT bearer skips
 * the OIDC path with no network).
 *
 * `cloudflare:workers` is stubbed (the publish + manage controllers transitively
 * import it) with `REGISTRY_ADMINS` set, so the admin-gated takedown path is
 * exercised. The controllers are imported dynamically AFTER the stub so it applies.
 */
mock.module("cloudflare:workers", () => ({
  env: { STORE_URL: "http://localhost:3000/", REGISTRY_ADMINS: "operator" },
}));

const { publish } = await import("./publish");
const { deprecate, yank, takedown, restore } = await import("./manage");
const {
  createScope,
  deleteMember,
  listMembers,
  putMember,
  setDisplayName,
  getScope,
  takedownScope,
  restoreScope,
  addTrustedPublisher,
  listTrustedPublishers,
  removeTrustedPublisher,
} = await import("./scope");

/** The status a handler yields, whether it returns a Response or throws an HttpError. */
async function statusOf(run: Promise<Response>): Promise<number> {
  try {
    return (await run).status;
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

// "operator" is the lone admin for the takedown/restore tests; passed explicitly
// (provider-qualified) rather than via the env, so these tests do not depend on the
// process-global `cloudflare:workers` mock surviving cross-file test ordering.
function services(db: Db): Provider[] {
  return provideRegistry({
    db,
    tarballs: fakeR2(),
    baseUrl: "http://localhost:8787",
    admins: new Set(["operator"]),
  });
}

/**
 * Run a handler inside the per-request injection context the `mount({ around })` wrapper
 * would establish in production, so its `inject(...)` calls resolve. `extra` providers are
 * appended after the graph's, so a test can override one dependency with a mock (a later
 * provider for the same token wins).
 */
function run<T>(providers: Provider[], fn: () => Promise<T>, extra: Provider[] = []): Promise<T> {
  return runInContext([...providers, ...extra], fn);
}

function post(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/", { method: "POST", headers, body: JSON.stringify(body) });
}

/** Seed the `@brika` scope with `owner` as its admin (for publish gates). */
async function seedBrikaScope(db: Db, owner: string): Promise<void> {
  await db.insert(regScopes).values({ scope: "@brika" });
  await db.insert(regScopeMembers).values({ scope: "@brika", userId: owner, role: "admin" });
}

/** Seed the example package (shared harness) plus an owner token for the auth tests. */
async function seedPackage(db: Db, owner: string): Promise<{ token: string }> {
  await seedExamplePackage(db, owner);
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
      await statusOf(
        run(services(db), () => publish({ body: validPublish, req: post(validPublish) })),
      ),
    ).toBe(401);
  });

  test("400 when the manifest name/version does not match the published name/version", async () => {
    const token = await issueToken(db, "octocat");
    const body = { ...validPublish, manifest: { name: "@brika/y", version: "2.0.0" } };
    expect(await statusOf(run(services(db), () => publish({ body, req: post(body, token) })))).toBe(
      400,
    );
  });

  test("400 for a non-canonical name (uppercase scope) before the ownership gate runs", async () => {
    const token = await issueToken(db, "octocat");
    const name = "@Brika/x"; // case variant of a real scope: must be refused at the door
    const body = { ...validPublish, name, manifest: { name, version: "1.0.0" } };
    expect(await statusOf(run(services(db), () => publish({ body, req: post(body, token) })))).toBe(
      400,
    );
  });

  test("403 when the scope has a different member set", async () => {
    // Publishing to a scope you are not a member of is forbidden.
    await seedBrikaScope(db, "octocat");
    const token = await issueToken(db, "stranger");
    expect(
      await statusOf(
        run(services(db), () => publish({ body: validPublish, req: post(validPublish, token) })),
      ),
    ).toBe(403);
  });

  test("409 when the publish service reports the version already exists", async () => {
    const token = await issueToken(db, "octocat");
    // Stub the domain so the controller's job under test - mapping the rejection
    // code to an HTTP status - is exercised without crafting a real tarball.
    const publishService = {
      publish: async () => ({ ok: false, code: "exists", message: "already exists" }),
    } as unknown as PublishService;
    expect(
      await statusOf(
        run(services(db), () => publish({ body: validPublish, req: post(validPublish, token) }), [
          { provide: PublishService, useValue: publishService },
        ]),
      ),
    ).toBe(409);
  });

  test("413 when the tarball is over the size limit", async () => {
    // The publisher must be a member of the scope to reach the size check.
    await seedBrikaScope(db, "octocat");
    const token = await issueToken(db, "octocat");
    // A 1-byte cap rejects even the tiny 3-byte "AAAA" tarball. PublishService is field-injected,
    // so just override its config token; the container builds it off the registry's wired ports.
    expect(
      await statusOf(
        run(services(db), () => publish({ body: validPublish, req: post(validPublish, token) }), [
          { provide: PublishConfig, useValue: { maxTarballBytes: 1 } },
        ]),
      ),
    ).toBe(413);
  });
});

describe("createScope (explicit scope claim)", () => {
  const params = { scope: "@team" };

  test("401 without a token", async () => {
    expect(
      await statusOf(run(services(db), () => createScope({ params, req: post(undefined) }))),
    ).toBe(401);
  });

  test("400 for a non-canonical scope", async () => {
    const token = await issueToken(db, "alice");
    const bad = { scope: "@Team" }; // uppercase: rejected by the canonical-scope rule
    expect(
      await statusOf(
        run(services(db), () => createScope({ params: bad, req: post(undefined, token) })),
      ),
    ).toBe(400);
  });

  test("201 creates the scope and seeds the caller as its admin member", async () => {
    const token = await issueToken(db, "alice");
    const res = await run(services(db), () => createScope({ params, req: post(undefined, token) }));
    expect(res.status).toBe(201);
    const rows = await db.select().from(regScopes).where(eq(regScopes.scope, "@team"));
    expect(rows[0]).toMatchObject({ scope: "@team", displayName: null });
    const members = await db
      .select()
      .from(regScopeMembers)
      .where(eq(regScopeMembers.scope, "@team"));
    expect(members).toEqual([expect.objectContaining({ userId: "alice", role: "admin" })]);
  });

  test("200 (idempotent) when the caller already administers the scope", async () => {
    const token = await issueToken(db, "alice");
    const ctx = services(db);
    await run(ctx, () => createScope({ params, req: post(undefined, token) }));
    const res = await run(ctx, () => createScope({ params, req: post(undefined, token) }));
    expect(res.status).toBe(200);
  });

  test("ORG-005-AC1: 429 once the per-account scope cap is reached", async () => {
    const ctx = services(db);
    const token = await issueToken(db, "hoarder");
    // The default cap is REGISTRY_LIMITS.maxScopesPerAccount (3); claim up to it, then over.
    for (const scope of ["@s1", "@s2", "@s3"]) {
      const res = await run(ctx, () =>
        createScope({ params: { scope }, req: post(undefined, token) }),
      );
      expect(res.status).toBe(201);
    }
    expect(
      await statusOf(
        run(ctx, () => createScope({ params: { scope: "@s4" }, req: post(undefined, token) })),
      ),
    ).toBe(429);
    // the over-cap scope was not created
    expect(await db.select().from(regScopes).where(eq(regScopes.scope, "@s4"))).toHaveLength(0);
  });

  test("409 when the scope is already claimed by someone else", async () => {
    await db.insert(regScopes).values({ scope: "@team" });
    await db.insert(regScopeMembers).values({ scope: "@team", userId: "alice", role: "admin" });
    const token = await issueToken(db, "mallory");
    expect(
      await statusOf(run(services(db), () => createScope({ params, req: post(undefined, token) }))),
    ).toBe(409);
  });

  test("concurrent creates resolve to one admin; the loser gets 409", async () => {
    const alice = await issueToken(db, "alice");
    const mallory = await issueToken(db, "mallory");
    const [a, b] = await Promise.all([
      statusOf(run(services(db), () => createScope({ params, req: post(undefined, alice) }))),
      statusOf(run(services(db), () => createScope({ params, req: post(undefined, mallory) }))),
    ]);
    expect([a, b].filter((s) => s === 201)).toHaveLength(1);
    expect([a, b].filter((s) => s === 409)).toHaveLength(1);
    expect(await db.select().from(regScopes).where(eq(regScopes.scope, "@team"))).toHaveLength(1);
  });
});

describe("scope members (roles + invariants)", () => {
  const scope = "@team";
  const memberParams = (id: string) => ({ scope, userId: id });
  const membersOf = () => db.select().from(regScopeMembers).where(eq(regScopeMembers.scope, scope));

  /** Claim scope `@team` with `adminLogin` as its admin; return the token. */
  async function seedScopeAdmin(adminLogin: string): Promise<string> {
    const token = await issueToken(db, adminLogin);
    await run(services(db), () => createScope({ params: { scope }, req: post(undefined, token) }));
    return token;
  }

  test("an admin adds a member; a non-admin cannot", async () => {
    const alice = await seedScopeAdmin("alice");
    const res = await run(services(db), () =>
      putMember({
        params: memberParams("bob"),
        body: { role: "member" },
        req: post(undefined, alice),
      }),
    );
    expect(res.status).toBe(200);
    expect((await membersOf()).map((m) => m.userId).sort((a, b) => a.localeCompare(b))).toEqual([
      "alice",
      "bob",
    ]);

    const bob = await issueToken(db, "bob"); // a plain member, not an admin
    expect(
      await statusOf(
        run(services(db), () =>
          putMember({
            params: memberParams("carol"),
            body: { role: "member" },
            req: post(undefined, bob),
          }),
        ),
      ),
    ).toBe(403);
  });

  test("a newly added member can publish under the scope", async () => {
    const alice = await seedScopeAdmin("alice");
    await run(services(db), () =>
      putMember({
        params: memberParams("bob"),
        body: { role: "member" },
        req: post(undefined, alice),
      }),
    );
    const bob = await issueToken(db, "bob");
    const body = {
      name: "@team/x",
      version: "1.0.0",
      manifest: { name: "@team/x", version: "1.0.0" },
      tarball: "AAAA",
    };
    // Reaches the size/validation gate (not 403), i.e. membership authorized the publish.
    expect(
      await statusOf(run(services(db), () => publish({ body, req: post(body, bob) }))),
    ).not.toBe(403);
  });

  test("listMembers requires membership", async () => {
    const alice = await seedScopeAdmin("alice");
    expect(
      (
        await run(services(db), () =>
          listMembers({ params: { scope }, req: post(undefined, alice) }),
        )
      ).status,
    ).toBe(200);
    const stranger = await issueToken(db, "bob");
    expect(
      await statusOf(
        run(services(db), () => listMembers({ params: { scope }, req: post(undefined, stranger) })),
      ),
    ).toBe(403);
  });

  test("the last admin cannot be demoted or removed (409)", async () => {
    const alice = await seedScopeAdmin("alice");
    expect(
      await statusOf(
        run(services(db), () =>
          putMember({
            params: memberParams("alice"),
            body: { role: "member" },
            req: post(undefined, alice),
          }),
        ),
      ),
    ).toBe(409);
    expect(
      await statusOf(
        run(services(db), () =>
          deleteMember({
            params: memberParams("alice"),
            req: post(undefined, alice),
          }),
        ),
      ),
    ).toBe(409);
  });

  test("concurrent demotions of two admins cannot leave the scope with zero admins", async () => {
    const alice = await seedScopeAdmin("alice");
    await run(services(db), () =>
      putMember({
        params: memberParams("bob"),
        body: { role: "admin" },
        req: post(undefined, alice),
      }),
    );
    const bob = await issueToken(db, "bob");

    // Both admins try to demote the other at once. The atomic SQL guard lets at most one
    // succeed, so the "at least one admin" invariant holds (no read-then-write TOCTOU).
    await Promise.allSettled([
      statusOf(
        run(services(db), () =>
          putMember({
            params: memberParams("bob"),
            body: { role: "member" },
            req: post(undefined, alice),
          }),
        ),
      ),
      statusOf(
        run(services(db), () =>
          putMember({
            params: memberParams("alice"),
            body: { role: "member" },
            req: post(undefined, bob),
          }),
        ),
      ),
    ]);
    const admins = (await membersOf()).filter((m) => m.role === "admin");
    expect(admins.length).toBeGreaterThanOrEqual(1);
  });

  test("with a second admin, one admin can be removed", async () => {
    const alice = await seedScopeAdmin("alice");
    await run(services(db), () =>
      putMember({
        params: memberParams("bob"),
        body: { role: "admin" },
        req: post(undefined, alice),
      }),
    );
    const res = await run(services(db), () =>
      deleteMember({
        params: memberParams("alice"),
        req: post(undefined, alice),
      }),
    );
    expect(res.status).toBe(200);
    expect((await membersOf()).map((m) => m.userId)).toEqual(["bob"]);
  });
});

describe("trusted publishers (PUB-016)", () => {
  /** Claim scope `@team` admined by `login`; return the admin token. */
  async function seedScope(login: string): Promise<string> {
    const token = await issueToken(db, login);
    await run(services(db), () =>
      createScope({ params: { scope: "@team" }, req: post(undefined, token) }),
    );
    return token;
  }
  const params = { scope: "@team" };
  const binding = { provider: "github", repository: "acme/plugin-x", workflow: "publish.yml" };

  test("an admin adds, lists, and removes a binding", async () => {
    const token = await seedScope("alice");
    expect(
      (
        await run(services(db), () =>
          addTrustedPublisher({ params, body: binding, req: post(undefined, token) }),
        )
      ).status,
    ).toBe(201);

    const listed = await (
      await run(services(db), () => listTrustedPublishers({ params, req: post(undefined, token) }))
    ).json();
    expect(listed.publishers).toMatchObject([{ scope: "@team", ...binding }]);

    expect(
      (
        await run(services(db), () =>
          removeTrustedPublisher({ params, body: binding, req: post(undefined, token) }),
        )
      ).status,
    ).toBe(200);
  });

  test("a non-admin cannot manage bindings (403)", async () => {
    await seedScope("alice");
    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        run(services(db), () =>
          addTrustedPublisher({ params, body: binding, req: post(undefined, bob) }),
        ),
      ),
    ).toBe(403);
  });
});

describe("deprecate / yank (ownership-gated mutations)", () => {
  // The `%2f` form arrives as one decoded segment, so `pkg` is the full name.
  const params = { pkg: "@brika/x", version: "1.0.0" };

  test("deprecate sets the version's message for an owner", async () => {
    const { token } = await seedPackage(db, "octocat");
    const res = await run(services(db), () =>
      deprecate({ params, body: { message: "use @brika/y" }, req: post(undefined, token) }),
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(regVersions);
    expect(rows[0]?.deprecated).toBe("use @brika/y");
  });

  test("yank hides the version from new installs for an owner", async () => {
    const { token } = await seedPackage(db, "octocat");
    const res = await run(services(db), () =>
      yank({ params, body: { yanked: true }, req: post(undefined, token) }),
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(regVersions);
    expect(rows[0]?.yanked).toBe(true);
  });

  test("401 without a token, 403 for a non-owner", async () => {
    await seedPackage(db, "octocat");
    const anon = statusOf(
      run(services(db), () => deprecate({ params, body: { message: null }, req: post(undefined) })),
    );
    expect(await anon).toBe(401);

    const stranger = await issueToken(db, "stranger");
    const forbidden = statusOf(
      run(services(db), () =>
        deprecate({ params, body: { message: null }, req: post(undefined, stranger) }),
      ),
    );
    expect(await forbidden).toBe(403);
  });
});

describe("takedown / restore (operator-gated)", () => {
  const params = { pkg: "@brika/x", version: "1.0.0" };
  // REGISTRY_ADMINS is "operator" (see the cloudflare:workers stub above).
  const asAdmin = (db: Db) => issueToken(db, "operator");

  test("403 for a valid credential that is not a registry admin", async () => {
    const { token } = await seedPackage(db, "octocat"); // owner, but not an admin
    const res = statusOf(
      run(services(db), () =>
        takedown({ params, body: { reason: "malware" }, req: post(undefined, token) }),
      ),
    );
    expect(await res).toBe(403);
  });

  test("an admin takedown hides the version from packument + catalog (reason surfaced), keeps bytes", async () => {
    await seedPackage(db, "octocat");
    const ctx = services(db);
    const token = await asAdmin(db);

    const res = await run(ctx, () =>
      takedown({
        params,
        body: { reason: "malware: exfiltrates env" },
        req: post(undefined, token),
      }),
    );
    expect(res.status).toBe(200);

    const packument = (await run(ctx, () => inject(ResolveService).packument("@brika/x"))) as {
      versions: Record<string, unknown>;
      takedowns?: Record<string, string>;
    };
    expect(Object.keys(packument.versions)).toEqual([]); // hidden from new installs
    expect(packument.takedowns).toEqual({ "1.0.0": "malware: exfiltrates env" }); // reason surfaced

    const catalog = await (
      await run(ctx, () => handleSearch(new Request("http://localhost/-/v1/packages")))
    ).json();
    expect(catalog.packages).toHaveLength(0);

    // Bytes/metadata retained: only the takedown flag changed.
    const rows = await db.select().from(regVersions);
    expect(rows[0]?.integrity).toBe("sha512-test");
    expect(rows[0]?.takedown).toBe("malware: exfiltrates env");
  });

  test("restore re-exposes a taken-down version", async () => {
    await seedPackage(db, "octocat");
    const ctx = services(db);
    const token = await asAdmin(db);

    await run(ctx, () =>
      takedown({ params, body: { reason: "policy" }, req: post(undefined, token) }),
    );
    const res = await run(ctx, () => restore({ params, req: post(undefined, token) }));
    expect(res.status).toBe(200);

    const packument = (await run(ctx, () => inject(ResolveService).packument("@brika/x"))) as {
      versions: Record<string, unknown>;
    };
    expect(Object.keys(packument.versions)).toEqual(["1.0.0"]);
  });
});

describe("scope takedown / restore (operator-gated, ORG-007)", () => {
  const params = { scope: "@brika" };
  const asAdmin = (db: Db) => issueToken(db, "operator");

  test("ORG-007-AC2: 403 for a valid credential that is not a registry admin", async () => {
    await seedBrikaScope(db, "octocat"); // a scope admin, but not a registry operator
    const token = await issueToken(db, "octocat");
    expect(
      await statusOf(
        run(services(db), () =>
          takedownScope({ params, body: { reason: "squat" }, req: post(undefined, token) }),
        ),
      ),
    ).toBe(403);
  });

  test("ORG-007-AC1: an operator takedown withdraws the scope from public listings; restore re-exposes it", async () => {
    await seedBrikaScope(db, "octocat");
    const ctx = services(db);
    const token = await asAdmin(db);

    expect((await run(ctx, () => getScope({ params }))).status).toBe(200);

    const res = await run(ctx, () =>
      takedownScope({ params, body: { reason: "name-squatting" }, req: post(undefined, token) }),
    );
    expect(res.status).toBe(200);
    // The public scope page 404s, and the reason is recorded (audited) but never leaked there.
    expect(await statusOf(run(ctx, () => getScope({ params })))).toBe(404);
    const taken = await db.select().from(regScopes).where(eq(regScopes.scope, "@brika"));
    expect(taken[0]?.takedown).toBe("name-squatting");

    expect(
      (await run(ctx, () => restoreScope({ params, req: post(undefined, token) }))).status,
    ).toBe(200);
    expect((await run(ctx, () => getScope({ params }))).status).toBe(200);
    const restored = await db.select().from(regScopes).where(eq(regScopes.scope, "@brika"));
    expect(restored[0]?.takedown).toBeNull();
  });

  test("404 when taking down a scope that does not exist", async () => {
    const token = await asAdmin(db);
    expect(
      await statusOf(
        run(services(db), () =>
          takedownScope({
            params: { scope: "@ghost" },
            body: { reason: "x" },
            req: post(undefined, token),
          }),
        ),
      ),
    ).toBe(404);
  });
});

describe("GET /-/v1/packages enumerate", () => {
  test("lists the latest non-yanked version with totals", async () => {
    await seedPackage(db, "octocat");
    const res = await run(services(db), () =>
      handleSearch(new Request("http://localhost/-/v1/packages")),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.packages[0].name).toBe("@brika/x");
  });

  test("free-text search filters by name", async () => {
    await seedPackage(db, "octocat");
    const miss = await run(services(db), () =>
      handleSearch(new Request("http://localhost/-/v1/packages?text=nomatch")),
    );
    expect((await miss.json()).total).toBe(0);
  });

  test("clamps the limit query parameter into range", async () => {
    await seedPackage(db, "octocat");
    const res = await run(services(db), () =>
      handleSearch(new Request("http://localhost/-/v1/packages?limit=5")),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(1);
  });
});

describe("handleSearch (SQL index: FTS + tag/capability)", () => {
  // Publish through the real writer so the `reg_search` projection is built (seedExamplePackage
  // inserts rows directly and does not, which is exactly why this path needs the writer).
  const publishSearchable = (db: Db) =>
    makeAdapter(db, D1MetadataWriter).commitVersion({
      scope: "@brika",
      tag: "latest",
      version: {
        name: "@brika/x",
        version: "1.0.0",
        manifest: {
          name: "@brika/x",
          version: "1.0.0",
          displayName: "Mapbox",
          description: "interactive maps",
          keywords: ["maps", "geo"],
          tools: [{}],
          engines: { brika: "^1.0.0" },
        },
        integrity: "sha512-x",
        shasum: "abc",
        size: 10,
        publishedAt: "2026-06-16T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        provenance: null,
      },
    });

  test("matches on full-text query plus a capability filter", async () => {
    await publishSearchable(db);
    const res = await run(services(db), () =>
      handleSearch(new Request("http://localhost/-/v1/search?text=map&capability=tools")),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.packages[0].name).toBe("@brika/x");
  });

  test("excludes packages that lack the requested tag", async () => {
    await publishSearchable(db);
    const res = await run(services(db), () =>
      handleSearch(new Request("http://localhost/-/v1/search?tags=geo,unrelated")),
    );
    expect((await res.json()).total).toBe(0);
  });
});

describe("handleDownloads", () => {
  test("returns zeroed stats for a package with no installs", async () => {
    await seedPackage(db, "octocat");
    const res = await run(services(db), () => handleDownloads("@brika/x"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ name: "@brika/x", total: 0, weekly: 0 });
  });
});

describe("publish atomicity (commitVersion + transaction)", () => {
  const commit = (meta: D1MetadataWriter) =>
    meta.commitVersion({
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

  test("commitVersion writes the package, version, and dist-tag together", async () => {
    await commit(makeAdapter(db, D1MetadataWriter));

    expect((await db.select().from(regPackages)).map((r) => r.name)).toContain("@brika/y");
    const versions = await db.select().from(regVersions);
    expect(versions.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0");
    const tags = await db.select().from(regDistTags);
    expect(tags.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0"); // tag moved in the same unit
  });

  test("commitVersion defers its write to the commit point, and a later failure rolls it back", async () => {
    const meta = makeAdapter(db, D1MetadataWriter);
    let writtenMidBody = -1;
    await expect(
      transaction(async () => {
        await commit(meta);
        // Deferred: nothing is written yet, so the write is order-independent and a
        // later step that throws takes the D1 write down with the staged tarball.
        writtenMidBody = (await db.select().from(regVersions)).length;
        throw new Error("a later step failed");
      }),
    ).rejects.toThrow("a later step failed");

    expect(writtenMidBody).toBe(0); // not written during the body
    expect(await db.select().from(regVersions)).toHaveLength(0); // and rolled back, not committed
  });

  test("commitVersion inside a successful transaction writes at the commit point", async () => {
    const meta = makeAdapter(db, D1MetadataWriter);
    await transaction(() => commit(meta));
    expect((await db.select().from(regVersions)).map((r) => r.name)).toContain("@brika/y");
  });

  // An R2 bucket whose backing store is exposed so a test can assert what is staged
  // vs. compensated. (fakeR2 hides its store; these tests need to see it.)
  const trackingR2 = (): { r2: R2Bucket; store: Map<string, Uint8Array> } => {
    const store = new Map<string, Uint8Array>();
    const r2 = {
      put: async (key: string, value: Uint8Array) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
    } as unknown as R2Bucket;
    return { r2, store };
  };

  test("a tarball put is rolled back (deleted) when the surrounding transaction fails", async () => {
    const { r2, store } = trackingR2();
    const tarballs = testBed(provide(TarballBucket, r2)).inject(R2TarballWriter);

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
    const { r2, store } = trackingR2();
    await testBed(provide(TarballBucket, r2))
      .inject(R2TarballWriter)
      .put("k", new Uint8Array([1]));
    expect(store.size).toBe(1);
  });
});

describe("scope publisher (verified attribution)", () => {
  test("packument + catalog expose the owning scope as the verified publisher", async () => {
    await seedPackage(db, "brikalabs");
    const ctx = services(db);

    const packument = (await run(ctx, () => inject(ResolveService).packument("@brika/x"))) as {
      publisher?: { id: string; name: string; verified: boolean };
    };
    // No display name yet -> falls back to the scope.
    expect(packument.publisher).toEqual({ id: "@brika", name: "@brika", verified: true });

    const catalog = await (
      await run(ctx, () => handleSearch(new Request("http://localhost/-/v1/packages")))
    ).json();
    expect(catalog.packages[0].publisher).toEqual({
      id: "@brika",
      name: "@brika",
      verified: true,
    });
  });

  test("a scope admin sets the display name; it becomes the verified publisher name", async () => {
    const { token } = await seedPackage(db, "brikalabs");
    const ctx = services(db);

    const res = await run(ctx, () =>
      setDisplayName({
        params: { scope: "@brika" },
        body: { displayName: "Brika Labs" },
        req: post(undefined, token),
      }),
    );
    expect(res.status).toBe(200);

    const packument = (await run(ctx, () => inject(ResolveService).packument("@brika/x"))) as {
      publisher?: { id: string; name: string; verified: boolean };
    };
    expect(packument.publisher).toEqual({ id: "@brika", name: "Brika Labs", verified: true });
  });

  test("a non-admin cannot set the display name (403)", async () => {
    await seedPackage(db, "brikalabs");
    const stranger = await issueToken(db, "intruder");
    const res = statusOf(
      run(services(db), () =>
        setDisplayName({
          params: { scope: "@brika" },
          body: { displayName: "Pwned" },
          req: post(undefined, stranger),
        }),
      ),
    );
    expect(await res).toBe(403);
  });
});
