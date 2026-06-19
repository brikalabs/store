import { beforeEach, describe, expect, test } from "bun:test";
import type { PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { makeDb } from "../test-harness";
import { D1OwnershipPolicy } from "./d1-ownership";

/**
 * Ownership gate: claim-on-first-publish, exact provider-qualified match afterwards,
 * and that the first-publish claim is race-safe (a loser of a concurrent claim is
 * rejected, not allowed to publish under a scope it does not own).
 */

const gh = (owner: string): PublishIdentity => ({ provider: "github", owner, repository: null });

let db: Db;
let policy: D1OwnershipPolicy;
beforeEach(() => {
  db = makeDb();
  policy = new D1OwnershipPolicy(db);
});

describe("D1OwnershipPolicy.canPublish", () => {
  test("refuses unscoped package names", async () => {
    const result = await policy.canPublish(gh("alice"), "lodash");
    expect(result.ok).toBe(false);
  });

  test("first publish claims the unclaimed scope for that identity", async () => {
    expect(await policy.canPublish(gh("alice"), "@team/a")).toEqual({ ok: true });
    const rows = await db.select().from(regScopes).where(eq(regScopes.scope, "@team"));
    expect(rows[0]).toMatchObject({ ownerProvider: "github", ownerId: "alice" });
  });

  test("the owner can keep publishing; a different identity is rejected", async () => {
    await policy.canPublish(gh("alice"), "@team/a");
    expect(await policy.canPublish(gh("alice"), "@team/b")).toEqual({ ok: true });
    const stranger = await policy.canPublish(gh("mallory"), "@team/c");
    expect(stranger.ok).toBe(false);
  });

  test("a different provider with the same owner id does not match", async () => {
    await policy.canPublish(gh("alice"), "@team/a");
    const other = await policy.canPublish(
      { provider: "gitlab", owner: "alice", repository: null },
      "@team/b",
    );
    expect(other.ok).toBe(false);
  });

  test("concurrent first-publishes by different identities yield exactly one owner; the loser is rejected", async () => {
    const [a, b] = await Promise.all([
      policy.canPublish(gh("alice"), "@race/a"),
      policy.canPublish(gh("mallory"), "@race/b"),
    ]);

    // Exactly one identity wins; the other is rejected (never both ok).
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    const rows = await db.select().from(regScopes).where(eq(regScopes.scope, "@race"));
    expect(rows).toHaveLength(1);
    const ownerId = rows[0]?.ownerId;
    expect(["alice", "mallory"]).toContain(ownerId);

    // The winner of the row is exactly the one whose canPublish returned ok.
    const winnerOk = ownerId === "alice" ? a.ok : b.ok;
    expect(winnerOk).toBe(true);
  });
});
