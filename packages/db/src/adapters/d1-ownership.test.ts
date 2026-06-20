import { beforeEach, describe, expect, test } from "bun:test";
import type { PublishIdentity } from "@brika/registry-core";
import type { Db } from "../client";
import { regScopeMembers, regScopes } from "../schema";
import { makeDb } from "../test-harness";
import { D1OwnershipPolicy } from "./d1-ownership";
import { D1ScopeMembers } from "./d1-scope-members";

/**
 * Publish authorization. Scopes are created explicitly (the scope controller) and only
 * their MEMBERS may publish, so the gate's job is: refuse unscoped names, refuse an
 * unknown scope, refuse a non-member, and allow any member.
 */

const gh = (owner: string): PublishIdentity => ({ provider: "github", owner, repository: null });

/** Seed a scope owned by `owner`, with `members` as its members (role defaults to admin). */
async function seedScope(
  db: Db,
  scope: string,
  owner: string,
  members: ReadonlyArray<{ provider?: string; id: string; role?: "admin" | "member" }> = [
    { id: owner, role: "admin" },
  ],
): Promise<void> {
  await db.insert(regScopes).values({ scope, ownerId: owner });
  for (const m of members) {
    await db
      .insert(regScopeMembers)
      .values({ scope, provider: m.provider ?? "github", memberId: m.id, role: m.role ?? "admin" });
  }
}

let db: Db;
let policy: D1OwnershipPolicy;
beforeEach(() => {
  db = makeDb();
  policy = new D1OwnershipPolicy(db, new D1ScopeMembers(db));
});

describe("D1OwnershipPolicy.canPublish", () => {
  test("refuses unscoped package names", async () => {
    expect((await policy.canPublish(gh("alice"), "lodash")).ok).toBe(false);
  });

  test("refuses publishing to a scope that does not exist (no implicit claim)", async () => {
    const result = await policy.canPublish(gh("alice"), "@team/a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("does not exist");
    expect(await db.select().from(regScopes)).toHaveLength(0); // no side-effect claim
  });

  test("allows any member (admin or member) and refuses non-members", async () => {
    await seedScope(db, "@team", "alice", [
      { id: "alice", role: "admin" },
      { id: "bob", role: "member" },
    ]);
    expect(await policy.canPublish(gh("alice"), "@team/a")).toEqual({ ok: true });
    expect(await policy.canPublish(gh("bob"), "@team/b")).toEqual({ ok: true });

    const stranger = await policy.canPublish(gh("mallory"), "@team/c");
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.message).toContain("not a member");
  });

  test("a different provider with the same id is not the same member", async () => {
    await seedScope(db, "@team", "alice");
    const other = await policy.canPublish(
      { provider: "gitlab", owner: "alice", repository: null },
      "@team/b",
    );
    expect(other.ok).toBe(false);
  });
});
