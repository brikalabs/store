import { beforeEach, describe, expect, mock, test } from "bun:test";
import { PublishService } from "@brika/registry-core";
import { HttpError } from "@brika/router";
import {
  type Db,
  regDistTags,
  regOrgMembers,
  regOrgs,
  regPackages,
  regScopes,
  regVersions,
} from "@brika/store-db";
import {
  D1MetadataWriter,
  D1OrgMembers,
  D1OrgScopes,
  D1OwnershipPolicy,
  D1TrustedPublishers,
  issueToken,
} from "@brika/store-db/adapters";
import { transaction } from "@brika/tx";
import { eq } from "drizzle-orm";
import { SchemaManifestValidator } from "../adapters/manifest-validator";
import { R2TarballWriter } from "../adapters/r2-tarball-writer";
import { buildServices, type Services } from "../services";
import { fakeR2, makeDb, seedExamplePackage } from "../test-harness";
import { handleCatalog } from "./catalog";
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
  createOrg,
  deleteMember,
  listMembers,
  putMember,
  setDisplayName,
  attachScope,
  getOrg,
  takedownOrg,
  restoreOrg,
  addTrustedPublisher,
  listTrustedPublishers,
  removeTrustedPublisher,
} = await import("./org");

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
function services(db: Db): Services {
  return buildServices(db, fakeR2(), "http://localhost:8787", new Set(["github:operator"]));
}

function post(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/", { method: "POST", headers, body: JSON.stringify(body) });
}

/** Attach the `@brika` scope to org `brika` with `owner` as its admin (for publish gates). */
async function seedBrikaOrg(db: Db, owner: string): Promise<void> {
  await db.insert(regOrgs).values({ slug: "brika" });
  await db
    .insert(regOrgMembers)
    .values({ orgSlug: "brika", provider: "github", memberId: owner, role: "admin" });
  await db.insert(regScopes).values({ scope: "@brika", orgId: "brika" });
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
      await statusOf(publish({ body: validPublish, req: post(validPublish), ctx: services(db) })),
    ).toBe(401);
  });

  test("400 when the manifest name/version does not match the published name/version", async () => {
    const token = await issueToken(db, "octocat");
    const body = { ...validPublish, manifest: { name: "@brika/y", version: "2.0.0" } };
    expect(await statusOf(publish({ body, req: post(body, token), ctx: services(db) }))).toBe(400);
  });

  test("400 for a non-canonical name (uppercase scope) before the ownership gate runs", async () => {
    const token = await issueToken(db, "octocat");
    const name = "@Brika/x"; // case variant of a real scope: must be refused at the door
    const body = { ...validPublish, name, manifest: { name, version: "1.0.0" } };
    expect(await statusOf(publish({ body, req: post(body, token), ctx: services(db) }))).toBe(400);
  });

  test("403 when the scope's org has a different member set", async () => {
    // Scopes are attached to an org explicitly, never on publish; publishing to a scope
    // owned by an org you are not a member of is forbidden.
    await seedBrikaOrg(db, "octocat");
    const token = await issueToken(db, "stranger");
    expect(
      await statusOf(
        publish({ body: validPublish, req: post(validPublish, token), ctx: services(db) }),
      ),
    ).toBe(403);
  });

  test("409 when the publish service reports the version already exists", async () => {
    const token = await issueToken(db, "octocat");
    // Stub the domain so the controller's job under test - mapping the rejection
    // code to an HTTP status - is exercised without crafting a real tarball.
    const ctx: Services = {
      ...services(db),
      publish: {
        publish: async () => ({ ok: false, code: "exists", message: "already exists" }),
      } as unknown as Services["publish"],
    };
    expect(
      await statusOf(publish({ body: validPublish, req: post(validPublish, token), ctx })),
    ).toBe(409);
  });

  test("413 when the tarball is over the size limit", async () => {
    // The scope must be attached and the publisher a member of its org to reach the size check.
    await seedBrikaOrg(db, "octocat");
    const token = await issueToken(db, "octocat");
    // A 1-byte cap rejects even the tiny 3-byte "AAAA" tarball.
    const ctx = {
      ...services(db),
      publish: new PublishService(
        new D1MetadataWriter(db),
        new R2TarballWriter(fakeR2()),
        new SchemaManifestValidator(),
        new D1OwnershipPolicy(
          new D1OrgMembers(db),
          new D1OrgScopes(db),
          new D1TrustedPublishers(db),
        ),
        { maxTarballBytes: 1 },
      ),
    };
    expect(
      await statusOf(publish({ body: validPublish, req: post(validPublish, token), ctx })),
    ).toBe(413);
  });
});

describe("createOrg (explicit org claim)", () => {
  const params = { org: "team" };

  test("401 without a token", async () => {
    expect(await statusOf(createOrg({ params, req: post(undefined), ctx: services(db) }))).toBe(
      401,
    );
  });

  test("400 for a non-canonical org slug", async () => {
    const token = await issueToken(db, "alice");
    const bad = { org: "Team" }; // uppercase: rejected by the JSR-style rule
    expect(
      await statusOf(createOrg({ params: bad, req: post(undefined, token), ctx: services(db) })),
    ).toBe(400);
  });

  test("201 creates the org and seeds the caller as its admin member", async () => {
    const token = await issueToken(db, "alice");
    const res = await createOrg({ params, req: post(undefined, token), ctx: services(db) });
    expect(res.status).toBe(201);
    const rows = await db.select().from(regOrgs).where(eq(regOrgs.slug, "team"));
    expect(rows[0]).toMatchObject({ slug: "team", displayName: null });
    const members = await db.select().from(regOrgMembers).where(eq(regOrgMembers.orgSlug, "team"));
    expect(members).toEqual([
      expect.objectContaining({ provider: "github", memberId: "alice", role: "admin" }),
    ]);
  });

  test("200 (idempotent) when the caller already administers the org", async () => {
    const token = await issueToken(db, "alice");
    await createOrg({ params, req: post(undefined, token), ctx: services(db) });
    const res = await createOrg({ params, req: post(undefined, token), ctx: services(db) });
    expect(res.status).toBe(200);
  });

  test("ORG-005-AC1: 429 once the per-account org cap is reached", async () => {
    const ctx = services(db);
    const token = await issueToken(db, "hoarder");
    // The default cap is REGISTRY_LIMITS.maxOrgsPerAccount (3); claim up to it, then over.
    for (const org of ["s1", "s2", "s3"]) {
      const res = await createOrg({ params: { org }, req: post(undefined, token), ctx });
      expect(res.status).toBe(201);
    }
    expect(
      await statusOf(createOrg({ params: { org: "s4" }, req: post(undefined, token), ctx })),
    ).toBe(429);
    // the over-cap org was not created
    expect(await db.select().from(regOrgs).where(eq(regOrgs.slug, "s4"))).toHaveLength(0);
  });

  test("409 when the org is already claimed by someone else", async () => {
    await db.insert(regOrgs).values({ slug: "team" });
    await db
      .insert(regOrgMembers)
      .values({ orgSlug: "team", provider: "github", memberId: "alice", role: "admin" });
    const token = await issueToken(db, "mallory");
    expect(
      await statusOf(createOrg({ params, req: post(undefined, token), ctx: services(db) })),
    ).toBe(409);
  });

  test("concurrent creates resolve to one admin; the loser gets 409", async () => {
    const alice = await issueToken(db, "alice");
    const mallory = await issueToken(db, "mallory");
    const [a, b] = await Promise.all([
      statusOf(createOrg({ params, req: post(undefined, alice), ctx: services(db) })),
      statusOf(createOrg({ params, req: post(undefined, mallory), ctx: services(db) })),
    ]);
    expect([a, b].filter((s) => s === 201)).toHaveLength(1);
    expect([a, b].filter((s) => s === 409)).toHaveLength(1);
    expect(await db.select().from(regOrgs).where(eq(regOrgs.slug, "team"))).toHaveLength(1);
  });
});

describe("org members (roles + invariants)", () => {
  const org = "team";
  const memberParams = (id: string) => ({ org, provider: "github", id });
  const membersOf = () => db.select().from(regOrgMembers).where(eq(regOrgMembers.orgSlug, org));

  /** Create org `team` with `adminLogin` as its admin, owning scope `@team`; return the token. */
  async function seedOrgAdmin(adminLogin: string): Promise<string> {
    const token = await issueToken(db, adminLogin);
    const ctx = services(db);
    await createOrg({ params: { org }, req: post(undefined, token), ctx });
    await attachScope({ params: { org, scope: "@team" }, req: post(undefined, token), ctx });
    return token;
  }

  test("an admin adds a member; a non-admin cannot", async () => {
    const alice = await seedOrgAdmin("alice");
    const res = await putMember({
      params: memberParams("bob"),
      body: { role: "member" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    expect(res.status).toBe(200);
    expect((await membersOf()).map((m) => m.memberId).sort((a, b) => a.localeCompare(b))).toEqual([
      "alice",
      "bob",
    ]);

    const bob = await issueToken(db, "bob"); // a plain member, not an admin
    expect(
      await statusOf(
        putMember({
          params: memberParams("carol"),
          body: { role: "member" },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ).toBe(403);
  });

  test("a newly added member can publish under a scope the org owns", async () => {
    const alice = await seedOrgAdmin("alice");
    await putMember({
      params: memberParams("bob"),
      body: { role: "member" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    const bob = await issueToken(db, "bob");
    const body = {
      name: "@team/x",
      version: "1.0.0",
      manifest: { name: "@team/x", version: "1.0.0" },
      tarball: "AAAA",
    };
    // Reaches the size/validation gate (not 403), i.e. membership authorized the publish.
    expect(await statusOf(publish({ body, req: post(body, bob), ctx: services(db) }))).not.toBe(
      403,
    );
  });

  test("listMembers requires membership", async () => {
    const alice = await seedOrgAdmin("alice");
    expect(
      (await listMembers({ params: { org }, req: post(undefined, alice), ctx: services(db) }))
        .status,
    ).toBe(200);
    const stranger = await issueToken(db, "bob");
    expect(
      await statusOf(
        listMembers({ params: { org }, req: post(undefined, stranger), ctx: services(db) }),
      ),
    ).toBe(403);
  });

  test("the last admin cannot be demoted or removed (409)", async () => {
    const alice = await seedOrgAdmin("alice");
    expect(
      await statusOf(
        putMember({
          params: memberParams("alice"),
          body: { role: "member" },
          req: post(undefined, alice),
          ctx: services(db),
        }),
      ),
    ).toBe(409);
    expect(
      await statusOf(
        deleteMember({
          params: memberParams("alice"),
          req: post(undefined, alice),
          ctx: services(db),
        }),
      ),
    ).toBe(409);
  });

  test("concurrent demotions of two admins cannot leave the org with zero admins", async () => {
    const alice = await seedOrgAdmin("alice");
    await putMember({
      params: memberParams("bob"),
      body: { role: "admin" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    const bob = await issueToken(db, "bob");

    // Both admins try to demote the other at once. The atomic SQL guard lets at most one
    // succeed, so the "at least one admin" invariant holds (no read-then-write TOCTOU).
    await Promise.allSettled([
      statusOf(
        putMember({
          params: memberParams("bob"),
          body: { role: "member" },
          req: post(undefined, alice),
          ctx: services(db),
        }),
      ),
      statusOf(
        putMember({
          params: memberParams("alice"),
          body: { role: "member" },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ]);
    const admins = (await membersOf()).filter((m) => m.role === "admin");
    expect(admins.length).toBeGreaterThanOrEqual(1);
  });

  test("with a second admin, one admin can be removed", async () => {
    const alice = await seedOrgAdmin("alice");
    await putMember({
      params: memberParams("bob"),
      body: { role: "admin" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    const res = await deleteMember({
      params: memberParams("alice"),
      req: post(undefined, alice),
      ctx: services(db),
    });
    expect(res.status).toBe(200);
    expect((await membersOf()).map((m) => m.memberId)).toEqual(["bob"]);
  });
});

describe("attachScope (1:N org -> scopes)", () => {
  /** Create org `team` admined by `login`; return the token. */
  async function seedOrgAdmin(login: string): Promise<string> {
    const token = await issueToken(db, login);
    await createOrg({ params: { org: "team" }, req: post(undefined, token), ctx: services(db) });
    return token;
  }

  test("an admin attaches a scope; a non-admin cannot (ORG-008)", async () => {
    const alice = await seedOrgAdmin("alice");
    const res = await attachScope({
      params: { org: "team", scope: "@team" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    expect(res.status).toBe(201);
    expect(await db.select().from(regScopes).where(eq(regScopes.scope, "@team"))).toMatchObject([
      { scope: "@team", orgId: "team" },
    ]);

    const bob = await issueToken(db, "bob"); // not a member
    expect(
      await statusOf(
        attachScope({
          params: { org: "team", scope: "@team2" },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ).toBe(403);
  });

  test("ORG-002-AC3: a scope already owned by another org is refused (409)", async () => {
    const alice = await seedOrgAdmin("alice");
    await attachScope({
      params: { org: "team", scope: "@shared" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    const bob = await issueToken(db, "bob");
    await createOrg({ params: { org: "other" }, req: post(undefined, bob), ctx: services(db) });
    expect(
      await statusOf(
        attachScope({
          params: { org: "other", scope: "@shared" },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ).toBe(409);
  });
});

describe("trusted publishers (PUB-016)", () => {
  /** Create org `team` admined by `login` owning scope `@team`; return the admin token. */
  async function seedScope(login: string): Promise<string> {
    const token = await issueToken(db, login);
    await createOrg({ params: { org: "team" }, req: post(undefined, token), ctx: services(db) });
    await attachScope({
      params: { org: "team", scope: "@team" },
      req: post(undefined, token),
      ctx: services(db),
    });
    return token;
  }
  const params = { org: "team", scope: "@team" };
  const binding = { provider: "github", repository: "acme/plugin-x", workflow: "publish.yml" };

  test("an admin adds, lists, and removes a binding", async () => {
    const token = await seedScope("alice");
    expect(
      (
        await addTrustedPublisher({
          params,
          body: binding,
          req: post(undefined, token),
          ctx: services(db),
        })
      ).status,
    ).toBe(201);

    const listed = await (
      await listTrustedPublishers({ params, req: post(undefined, token), ctx: services(db) })
    ).json();
    expect(listed.publishers).toMatchObject([{ scope: "@team", ...binding }]);

    expect(
      (
        await removeTrustedPublisher({
          params,
          body: binding,
          req: post(undefined, token),
          ctx: services(db),
        })
      ).status,
    ).toBe(200);
  });

  test("a non-admin cannot manage bindings (403)", async () => {
    await seedScope("alice");
    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        addTrustedPublisher({
          params,
          body: binding,
          req: post(undefined, bob),
          ctx: services(db),
        }),
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

describe("takedown / restore (operator-gated)", () => {
  const params = { pkg: "@brika/x", version: "1.0.0" };
  // REGISTRY_ADMINS is "operator" (see the cloudflare:workers stub above).
  const asAdmin = (db: Db) => issueToken(db, "operator");

  test("403 for a valid credential that is not a registry admin", async () => {
    const { token } = await seedPackage(db, "octocat"); // owner, but not an admin
    const res = statusOf(
      takedown({
        params,
        body: { reason: "malware" },
        req: post(undefined, token),
        ctx: services(db),
      }),
    );
    expect(await res).toBe(403);
  });

  test("an admin takedown hides the version from packument + catalog (reason surfaced), keeps bytes", async () => {
    await seedPackage(db, "octocat");
    const ctx = services(db);
    const token = await asAdmin(db);

    const res = await takedown({
      params,
      body: { reason: "malware: exfiltrates env" },
      req: post(undefined, token),
      ctx,
    });
    expect(res.status).toBe(200);

    const packument = (await ctx.resolve.packument("@brika/x")) as {
      versions: Record<string, unknown>;
      takedowns?: Record<string, string>;
    };
    expect(Object.keys(packument.versions)).toEqual([]); // hidden from new installs
    expect(packument.takedowns).toEqual({ "1.0.0": "malware: exfiltrates env" }); // reason surfaced

    const catalog = await (
      await handleCatalog(new Request("http://localhost/-/v1/packages"), ctx)
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

    await takedown({ params, body: { reason: "policy" }, req: post(undefined, token), ctx });
    const res = await restore({ params, req: post(undefined, token), ctx });
    expect(res.status).toBe(200);

    const packument = (await ctx.resolve.packument("@brika/x")) as {
      versions: Record<string, unknown>;
    };
    expect(Object.keys(packument.versions)).toEqual(["1.0.0"]);
  });
});

describe("org takedown / restore (operator-gated, ORG-007)", () => {
  const params = { org: "brika" };
  const asAdmin = (db: Db) => issueToken(db, "operator");

  test("ORG-007-AC2: 403 for a valid credential that is not a registry admin", async () => {
    await seedBrikaOrg(db, "octocat"); // an org admin, but not a registry operator
    const token = await issueToken(db, "octocat");
    expect(
      await statusOf(
        takedownOrg({
          params,
          body: { reason: "squat" },
          req: post(undefined, token),
          ctx: services(db),
        }),
      ),
    ).toBe(403);
  });

  test("ORG-007-AC1: an operator takedown withdraws the org from public listings; restore re-exposes it", async () => {
    await seedBrikaOrg(db, "octocat");
    const ctx = services(db);
    const token = await asAdmin(db);

    expect((await getOrg({ params, ctx })).status).toBe(200);

    const res = await takedownOrg({
      params,
      body: { reason: "name-squatting" },
      req: post(undefined, token),
      ctx,
    });
    expect(res.status).toBe(200);
    // The public org page 404s, and the reason is recorded (audited) but never leaked there.
    expect(await statusOf(getOrg({ params, ctx }))).toBe(404);
    const taken = await db.select().from(regOrgs).where(eq(regOrgs.slug, "brika"));
    expect(taken[0]?.takedown).toBe("name-squatting");

    expect((await restoreOrg({ params, req: post(undefined, token), ctx })).status).toBe(200);
    expect((await getOrg({ params, ctx })).status).toBe(200);
    const restored = await db.select().from(regOrgs).where(eq(regOrgs.slug, "brika"));
    expect(restored[0]?.takedown).toBeNull();
  });

  test("404 when taking down an org that does not exist", async () => {
    const token = await asAdmin(db);
    expect(
      await statusOf(
        takedownOrg({
          params: { org: "ghost" },
          body: { reason: "x" },
          req: post(undefined, token),
          ctx: services(db),
        }),
      ),
    ).toBe(404);
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

  test("clamps the limit query parameter into range", async () => {
    await seedPackage(db, "octocat");
    const res = await handleCatalog(
      new Request("http://localhost/-/v1/packages?limit=5"),
      services(db),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(1);
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
    await commit(new D1MetadataWriter(db));

    expect((await db.select().from(regPackages)).map((r) => r.name)).toContain("@brika/y");
    const versions = await db.select().from(regVersions);
    expect(versions.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0");
    const tags = await db.select().from(regDistTags);
    expect(tags.find((r) => r.name === "@brika/y")?.version).toBe("1.0.0"); // tag moved in the same unit
  });

  test("commitVersion defers its write to the commit point, and a later failure rolls it back", async () => {
    const meta = new D1MetadataWriter(db);
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
    const meta = new D1MetadataWriter(db);
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
    const { r2, store } = trackingR2();
    await new R2TarballWriter(r2).put("k", new Uint8Array([1]));
    expect(store.size).toBe(1);
  });
});

describe("org publisher (verified attribution)", () => {
  test("packument + catalog expose the owning org as the verified publisher", async () => {
    await seedPackage(db, "brikalabs");
    const ctx = services(db);

    const packument = (await ctx.resolve.packument("@brika/x")) as {
      publisher?: { id: string; name: string; verified: boolean };
    };
    // No display name yet -> falls back to the org slug.
    expect(packument.publisher).toEqual({ id: "brika", name: "brika", verified: true });

    const catalog = await (
      await handleCatalog(new Request("http://localhost/-/v1/packages"), ctx)
    ).json();
    expect(catalog.packages[0].publisher).toEqual({
      id: "brika",
      name: "brika",
      verified: true,
    });
  });

  test("an org admin sets the display name; it becomes the verified publisher name", async () => {
    const { token } = await seedPackage(db, "brikalabs");
    const ctx = services(db);

    const res = await setDisplayName({
      params: { org: "brika" },
      body: { displayName: "Brika Labs" },
      req: post(undefined, token),
      ctx,
    });
    expect(res.status).toBe(200);

    const packument = (await ctx.resolve.packument("@brika/x")) as {
      publisher?: { id: string; name: string; verified: boolean };
    };
    expect(packument.publisher).toEqual({ id: "brika", name: "Brika Labs", verified: true });
  });

  test("a non-admin cannot set the display name (403)", async () => {
    await seedPackage(db, "brikalabs");
    const stranger = await issueToken(db, "intruder");
    const res = statusOf(
      setDisplayName({
        params: { org: "brika" },
        body: { displayName: "Pwned" },
        req: post(undefined, stranger),
        ctx: services(db),
      }),
    );
    expect(await res).toBe(403);
  });
});
