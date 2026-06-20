import { beforeEach, describe, expect, test } from "bun:test";
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
  revokeTokenByHash,
} from "./queries";

let db: Db;
beforeEach(() => {
  db = makeDb();
});

async function scope(name: string, displayName: string | null = null) {
  await db.insert(regScopes).values({ scope: name, displayName });
}
async function member(scopeName: string, memberId: string, role: "admin" | "member") {
  await db.insert(regScopeMembers).values({ scope: scopeName, memberId, role });
}

describe("listScopesForMember", () => {
  test("returns every scope the member belongs to, with role + display name, sorted", async () => {
    await scope("@acme", "Acme Inc");
    await scope("@acme-labs");
    await scope("@beta");
    await member("@acme", "alice", "admin");
    await member("@acme-labs", "alice", "member");
    await member("@beta", "bob", "admin");

    const result = await listScopesForMember(db, "github", "alice");
    expect(result).toEqual([
      { scope: "@acme", role: "admin", displayName: "Acme Inc" },
      { scope: "@acme-labs", role: "member", displayName: null },
    ]);
  });

  test("is empty for a non-member", async () => {
    await scope("@acme");
    await member("@acme", "alice", "admin");
    expect(await listScopesForMember(db, "github", "nobody")).toEqual([]);
  });
});

describe("listAllPackages (operator directory)", () => {
  test("reports owning scope, latest version, and version counts", async () => {
    await seedExamplePackage(db, "octocat"); // @brika/x@1.0.0 owned by scope @brika
    const packages = await listAllPackages(db);
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
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

    const [pkg] = await listAllPackages(db);
    expect(pkg).toMatchObject({ versionCount: 3, takenDownCount: 1, yankedCount: 1 });
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

    const [pkg] = await listAllPackages(db);
    expect(pkg).toMatchObject({ name: "@orphan/y", scope: "@orphan", scopeDisplayName: null });
  });
});

describe("listSubjectTokens / revokeTokenByHash", () => {
  async function token(hash: string, subject: string, createdAt: number) {
    await db.insert(regTokens).values({
      tokenHash: hash,
      subject,
      createdAt,
      expiresAt: createdAt + 1000,
      lastUsedAt: null,
    });
  }

  test("lists a subject's tokens newest first, metadata only", async () => {
    await token("hash-old", "alice", 100);
    await token("hash-new", "alice", 200);
    await token("hash-bob", "bob", 150);

    const result = await listSubjectTokens(db, "github", "alice");
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
    expect(await revokeTokenByHash(db, "github", "alice", "hash-a")).toBe(true);
    expect(await listSubjectTokens(db, "github", "alice")).toEqual([]);
  });

  test("revoke refuses another subject's token (returns false, leaves it)", async () => {
    await token("hash-bob", "bob", 100);
    expect(await revokeTokenByHash(db, "github", "alice", "hash-bob")).toBe(false);
    expect(await listSubjectTokens(db, "github", "bob")).toHaveLength(1);
  });

  test("revoke returns false for an unknown token", async () => {
    expect(await revokeTokenByHash(db, "github", "alice", "nope")).toBe(false);
  });
});
