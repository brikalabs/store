import { beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  regDistTags,
  regPackages,
  regScopeMembers,
  regScopes,
  regTokens,
  regVersions,
} from "../schema";
import { makeDb, seedExamplePackage } from "../test-harness";
import {
  listAllPackages,
  listScopesForMember,
  listSubjectTokens,
  resolveActor,
  revokeTokenByHash,
} from "./queries";

let db: Db;
beforeEach(() => {
  db = makeDb();
});

async function scope(name: string, displayName: string | null = null) {
  await db.insert(regScopes).values({ scope: name, displayName });
}
async function member(scopeName: string, userId: string, role: "admin" | "member") {
  await db.insert(regScopeMembers).values({ scope: scopeName, userId, role });
}

describe("listScopesForMember", () => {
  test("returns every scope the member belongs to, with role + display name, sorted", async () => {
    await scope("@acme", "Acme Inc");
    await scope("@acme-labs");
    await scope("@beta");
    await member("@acme", "alice", "admin");
    await member("@acme-labs", "alice", "member");
    await member("@beta", "bob", "admin");

    const result = await listScopesForMember(db, "alice");
    expect(result).toEqual([
      { scope: "@acme", role: "admin", displayName: "Acme Inc", verified: false },
      { scope: "@acme-labs", role: "member", displayName: null, verified: false },
    ]);
  });

  test("is empty for a non-member", async () => {
    await scope("@acme");
    await member("@acme", "alice", "admin");
    expect(await listScopesForMember(db, "nobody")).toEqual([]);
  });
});

describe("listAllPackages (operator directory)", () => {
  const PAGE = { limit: 20, offset: 0 };

  // A bare package row (no scope membership / versions) with an explicit `createdAt`, so the
  // newest-first ordering and the page window are deterministic across tests.
  async function pkg(name: string, scopeName: string, createdAt: number) {
    await db.insert(regPackages).values({ name, scope: scopeName, createdAt });
  }

  test("reports owning scope, latest version, and version counts", async () => {
    await seedExamplePackage(db, "octocat"); // @brika/x@1.0.0 owned by scope @brika
    const page = await listAllPackages(db, PAGE);
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      name: "@brika/x",
      scope: "@brika",
      latestVersion: "1.0.0",
      versionCount: 1,
      takenDownCount: 0,
      yankedCount: 0,
    });
  });

  test("counts taken-down and yanked versions so an operator can find hidden packages", async () => {
    await seedExamplePackage(db, "octocat");
    // Versions the public catalog would hide entirely, but the operator must still see.
    await db.insert(regVersions).values({
      name: "@brika/x",
      version: "2.0.0",
      manifest: { name: "@brika/x", version: "2.0.0" },
      integrity: "sha512-two",
      shasum: "feedface",
      size: 1,
      takedown: "malware",
    });
    await db.insert(regVersions).values({
      name: "@brika/x",
      version: "1.5.0",
      manifest: { name: "@brika/x", version: "1.5.0" },
      integrity: "sha512-mid",
      shasum: "c0ffee",
      size: 1,
      yanked: true,
    });

    const { items } = await listAllPackages(db, PAGE);
    expect(items[0]).toMatchObject({ versionCount: 3, takenDownCount: 1, yankedCount: 1 });
  });

  test("includes a package whose scope is unclaimed (no reg_scopes row)", async () => {
    await db.insert(regPackages).values({ name: "@orphan/y", scope: "@orphan" });
    await db.insert(regVersions).values({
      name: "@orphan/y",
      version: "1.0.0",
      manifest: { name: "@orphan/y", version: "1.0.0" },
      integrity: "sha512-orphan",
      shasum: "ababab",
      size: 1,
    });
    await db.insert(regDistTags).values({ name: "@orphan/y", tag: "latest", version: "1.0.0" });

    const { items } = await listAllPackages(db, PAGE);
    expect(items[0]).toMatchObject({ name: "@orphan/y", scope: "@orphan", scopeDisplayName: null });
  });

  test("the q filter narrows by a case-insensitive name substring, total reflects the filter", async () => {
    await pkg("@acme/alpha", "@acme", 100);
    await pkg("@acme/beta", "@acme", 200);
    await pkg("@other/alpha-tool", "@other", 300);

    const all = await listAllPackages(db, PAGE);
    expect(all.total).toBe(3);

    const matched = await listAllPackages(db, { ...PAGE, q: "ALPHA" });
    expect(matched.total).toBe(2);
    expect(matched.items.map((p) => p.name).sort()).toEqual(["@acme/alpha", "@other/alpha-tool"]);

    const none = await listAllPackages(db, { ...PAGE, q: "nomatch" });
    expect(none.total).toBe(0);
    expect(none.items).toEqual([]);
  });

  test("limit/offset page the results, total stays the unfiltered-by-page count", async () => {
    // Newest-first: created 300 > 200 > 100, so the order is gamma, beta, alpha.
    await pkg("@acme/alpha", "@acme", 100);
    await pkg("@acme/beta", "@acme", 200);
    await pkg("@acme/gamma", "@acme", 300);

    const first = await listAllPackages(db, { q: undefined, limit: 2, offset: 0 });
    expect(first.total).toBe(3);
    expect(first.limit).toBe(2);
    expect(first.offset).toBe(0);
    expect(first.items.map((p) => p.name)).toEqual(["@acme/gamma", "@acme/beta"]);

    const second = await listAllPackages(db, { q: undefined, limit: 2, offset: 2 });
    expect(second.total).toBe(3);
    expect(second.offset).toBe(2);
    expect(second.items.map((p) => p.name)).toEqual(["@acme/alpha"]);
  });
});

describe("listSubjectTokens / revokeTokenByHash", () => {
  async function token(hash: string, userId: string, createdAt: number) {
    await db.insert(regTokens).values({
      tokenHash: hash,
      userId,
      createdAt,
      expiresAt: createdAt + 1000,
      lastUsedAt: null,
    });
  }

  test("lists an account's tokens newest first, metadata only", async () => {
    await token("hash-old", "alice", 100);
    await token("hash-new", "alice", 200);
    await token("hash-bob", "bob", 150);

    const result = await listSubjectTokens(db, "alice");
    expect(result.map((t) => t.tokenHash)).toEqual(["hash-new", "hash-old"]);
    expect(result[0]).toEqual({
      tokenHash: "hash-new",
      createdAt: 200,
      expiresAt: 1200,
      lastUsedAt: null,
    });
  });

  test("revoke removes the caller's own token", async () => {
    await token("hash-a", "alice", 100);
    expect(await revokeTokenByHash(db, "alice", "hash-a")).toBe(true);
    expect(await listSubjectTokens(db, "alice")).toEqual([]);
  });

  test("revoke refuses another account's token (returns false, leaves it)", async () => {
    await token("hash-bob", "bob", 100);
    expect(await revokeTokenByHash(db, "alice", "hash-bob")).toBe(false);
    expect(await listSubjectTokens(db, "bob")).toHaveLength(1);
  });

  test("revoke returns false for an unknown token", async () => {
    expect(await revokeTokenByHash(db, "alice", "nope")).toBe(false);
  });
});

describe("resolveActor", () => {
  // The store's `users` table is NOT in this package's `reg_*` schema (it belongs to the
  // web app) but lives in the SAME D1, so the resolver reads it with raw SQL. Create the
  // merged shape (profile columns folded onto `users`) by hand here to exercise that path.
  beforeEach(async () => {
    await db.run(
      sql`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, image TEXT)`,
    );
  });

  async function user(
    id: string,
    fields: { name?: string | null; displayName?: string | null; image?: string | null },
  ) {
    await db.run(
      sql`INSERT INTO users (id, name, display_name, image)
          VALUES (${id}, ${fields.name ?? null}, ${fields.displayName ?? null}, ${fields.image ?? null})`,
    );
  }

  test("prefers the profile display name, and returns the provider image as the avatar", async () => {
    await user("u1", { name: "Mona Lisa", displayName: "Mona the Octocat", image: "https://i/x" });
    expect(await resolveActor(db, "u1")).toEqual({
      displayName: "Mona the Octocat",
      avatarUrl: "https://i/x",
    });
  });

  test("falls back to users.name when no display name", async () => {
    await user("u1", { name: "Mona Lisa" });
    expect(await resolveActor(db, "u1")).toEqual({ displayName: "Mona Lisa", avatarUrl: null });
  });

  test("returns nulls when the account has neither a display name nor a name", async () => {
    await user("u1", {});
    expect(await resolveActor(db, "u1")).toEqual({ displayName: null, avatarUrl: null });
  });

  test("returns nulls for an unknown id", async () => {
    expect(await resolveActor(db, "ghost")).toEqual({ displayName: null, avatarUrl: null });
  });

  test("treats a whitespace-only display name as absent", async () => {
    await user("u1", { name: "Mona Lisa", displayName: "   " });
    expect(await resolveActor(db, "u1")).toEqual({ displayName: "Mona Lisa", avatarUrl: null });
  });
});
