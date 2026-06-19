import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regScopeMembers, regScopes, regTokens } from "../schema";
import { makeDb } from "../test-harness";
import { listScopesForMember, listSubjectTokens, revokeTokenByHash } from "./queries";

let db: Db;
beforeEach(() => {
  db = makeDb();
});

async function scope(name: string, ownerId: string, displayName: string | null = null) {
  await db.insert(regScopes).values({ scope: name, ownerId, displayName });
}
async function member(scopeName: string, memberId: string, role: "admin" | "member") {
  await db.insert(regScopeMembers).values({ scope: scopeName, memberId, role });
}

describe("listScopesForMember", () => {
  test("returns each scope the member belongs to, with role and display name", async () => {
    await scope("@acme", "alice", "Acme Inc");
    await scope("@beta", "bob");
    await scope("@other", "carol");
    await member("@acme", "alice", "admin");
    await member("@beta", "alice", "member");
    await member("@other", "carol", "admin");

    const result = await listScopesForMember(db, "github", "alice");
    expect(result).toEqual([
      { scope: "@acme", role: "admin", displayName: "Acme Inc" },
      { scope: "@beta", role: "member", displayName: null },
    ]);
  });

  test("is empty for a non-member", async () => {
    await scope("@acme", "alice");
    await member("@acme", "alice", "admin");
    expect(await listScopesForMember(db, "github", "nobody")).toEqual([]);
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
