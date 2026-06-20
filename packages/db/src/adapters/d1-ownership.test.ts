import { beforeEach, describe, expect, test } from "bun:test";
import type { PublishIdentity } from "@brika/registry-core";
import type { Db } from "../client";
import { regScopeMembers, regScopes, regTrustedPublishers } from "../schema";
import { makeDb } from "../test-harness";
import { D1OwnershipPolicy } from "./d1-ownership";
import { D1ScopeMembers } from "./d1-scope-members";
import { D1TrustedPublishers } from "./d1-trusted-publishers";

/** An OIDC (CI) publish identity: carries the repo + workflow_ref the registry verified. */
const oidc = (repository: string, workflowRef: string): PublishIdentity => ({
  provider: "github",
  owner: repository.split("/")[0] ?? repository,
  repository,
  provenance: { repository, workflowRef },
});

/**
 * Publish authorization (scope-as-owner model). The scope IS the account, and only MEMBERS
 * of the scope may publish via a token, so the gate's job is: refuse unscoped names, refuse a
 * non-member of the scope, and allow any member. CI (OIDC) publishes go through a trusted
 * publisher binding instead of membership.
 */

const gh = (owner: string): PublishIdentity => ({ provider: "github", owner, repository: null });

/**
 * Seed a `scope`, with `members` as its members (role defaults to admin).
 */
async function seedScope(
  db: Db,
  scope: string,
  members: ReadonlyArray<{ provider?: string; id: string; role?: "admin" | "member" }>,
): Promise<void> {
  await db.insert(regScopes).values({ scope });
  for (const m of members) {
    await db.insert(regScopeMembers).values({
      scope,
      provider: m.provider ?? "github",
      memberId: m.id,
      role: m.role ?? "admin",
    });
  }
}

let db: Db;
let policy: D1OwnershipPolicy;
beforeEach(() => {
  db = makeDb();
  policy = new D1OwnershipPolicy(new D1ScopeMembers(db), new D1TrustedPublishers(db));
});

describe("D1OwnershipPolicy.canPublish", () => {
  test("refuses unscoped package names", async () => {
    expect((await policy.canPublish(gh("alice"), "lodash")).ok).toBe(false);
  });

  test("refuses publishing to an unclaimed scope (no members)", async () => {
    const result = await policy.canPublish(gh("alice"), "@team/a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not a member");
    expect(await db.select().from(regScopes)).toHaveLength(0); // no side-effect claim
  });

  test("allows any member (admin or member) of the scope and refuses non-members", async () => {
    await seedScope(db, "@team", [
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
    await seedScope(db, "@team", [{ id: "alice", role: "admin" }]);
    const other = await policy.canPublish(
      { provider: "gitlab", owner: "alice", repository: null },
      "@team/b",
    );
    expect(other.ok).toBe(false);
  });

  describe("OIDC (CI) publish via trusted publishers (PUB-016)", () => {
    const workflowRef = "acme/plugin-x/.github/workflows/publish.yml@refs/heads/main";

    test("PUB-016-AC1: allows an OIDC publish when a binding matches repo + workflow", async () => {
      await seedScope(db, "@team", [{ id: "alice", role: "admin" }]);
      await db
        .insert(regTrustedPublishers)
        .values({ scope: "@team", repository: "acme/plugin-x", workflow: "publish.yml" });
      expect(await policy.canPublish(oidc("acme/plugin-x", workflowRef), "@team/x")).toEqual({
        ok: true,
      });
    });

    test("PUB-016-AC2: refuses an OIDC publish with no binding (membership is NOT a fallback for CI)", async () => {
      // The repo owner `acme` is even seeded as a scope member, but OIDC still needs a binding.
      await seedScope(db, "@team", [{ id: "acme", role: "admin" }]);
      const result = await policy.canPublish(oidc("acme/plugin-x", workflowRef), "@team/x");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("no trusted publisher");
    });

    test("refuses when the binding is for a different repo or workflow", async () => {
      await seedScope(db, "@team", [{ id: "alice", role: "admin" }]);
      await db
        .insert(regTrustedPublishers)
        .values({ scope: "@team", repository: "acme/other-repo", workflow: "publish.yml" });
      expect((await policy.canPublish(oidc("acme/plugin-x", workflowRef), "@team/x")).ok).toBe(
        false,
      );
      // Right repo, wrong workflow filename.
      await db
        .insert(regTrustedPublishers)
        .values({ scope: "@team", repository: "acme/plugin-x", workflow: "release.yml" });
      expect((await policy.canPublish(oidc("acme/plugin-x", workflowRef), "@team/x")).ok).toBe(
        false,
      );
    });
  });
});
