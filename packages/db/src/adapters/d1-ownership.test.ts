import { beforeEach, describe, expect, test } from "bun:test";
import type { PublishIdentity } from "@brika/registry-core";
import type { Db } from "../client";
import { regOrgMembers, regOrgs, regScopes } from "../schema";
import { makeDb } from "../test-harness";
import { D1OrgMembers } from "./d1-org-members";
import { D1OrgScopes } from "./d1-org-scopes";
import { D1OwnershipPolicy } from "./d1-ownership";

/**
 * Publish authorization (1:N org model). A scope is attached to an org explicitly, and only
 * MEMBERS of the owning org may publish, so the gate's job is: refuse unscoped names, refuse
 * a scope attached to no org, refuse a non-member of the owning org, and allow any member.
 */

const gh = (owner: string): PublishIdentity => ({ provider: "github", owner, repository: null });

/**
 * Seed an org owning `scope`, with `members` as its members (role defaults to admin).
 */
async function seedOrg(
  db: Db,
  org: string,
  scope: string,
  members: ReadonlyArray<{ provider?: string; id: string; role?: "admin" | "member" }>,
): Promise<void> {
  await db.insert(regOrgs).values({ slug: org });
  for (const m of members) {
    await db.insert(regOrgMembers).values({
      orgSlug: org,
      provider: m.provider ?? "github",
      memberId: m.id,
      role: m.role ?? "admin",
    });
  }
  await db.insert(regScopes).values({ scope, orgId: org });
}

let db: Db;
let policy: D1OwnershipPolicy;
beforeEach(() => {
  db = makeDb();
  policy = new D1OwnershipPolicy(new D1OrgMembers(db), new D1OrgScopes(db));
});

describe("D1OwnershipPolicy.canPublish", () => {
  test("refuses unscoped package names", async () => {
    expect((await policy.canPublish(gh("alice"), "lodash")).ok).toBe(false);
  });

  test("refuses publishing to a scope attached to no org (no implicit claim)", async () => {
    const result = await policy.canPublish(gh("alice"), "@team/a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not attached to an organisation");
    expect(await db.select().from(regScopes)).toHaveLength(0); // no side-effect claim
  });

  test("allows any member (admin or member) of the owning org and refuses non-members", async () => {
    await seedOrg(db, "team", "@team", [
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
    await seedOrg(db, "team", "@team", [{ id: "alice", role: "admin" }]);
    const other = await policy.canPublish(
      { provider: "gitlab", owner: "alice", repository: null },
      "@team/b",
    );
    expect(other.ok).toBe(false);
  });
});
