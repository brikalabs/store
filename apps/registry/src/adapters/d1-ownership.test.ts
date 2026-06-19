import { beforeEach, describe, expect, test } from "bun:test";
import type { PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { makeDb } from "../test-harness";
import { D1OwnershipPolicy } from "./d1-ownership";

/**
 * Ownership gate. Scopes are claimed by explicit creation (the scope controller), never
 * implicitly on publish, so the gate's job is: refuse unscoped names, refuse an unknown
 * scope, and otherwise require an exact provider-qualified owner match.
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
    expect((await policy.canPublish(gh("alice"), "lodash")).ok).toBe(false);
  });

  test("refuses publishing to a scope that does not exist (no implicit claim)", async () => {
    const result = await policy.canPublish(gh("alice"), "@team/a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("does not exist");
    // The gate must not have created the scope as a side effect.
    expect(await db.select().from(regScopes)).toHaveLength(0);
  });

  test("allows the scope owner and refuses everyone else", async () => {
    await db.insert(regScopes).values({ scope: "@team", ownerId: "alice" });
    expect(await policy.canPublish(gh("alice"), "@team/a")).toEqual({ ok: true });
    expect((await policy.canPublish(gh("mallory"), "@team/b")).ok).toBe(false);
  });

  test("a different provider with the same owner id does not match", async () => {
    await db.insert(regScopes).values({ scope: "@team", ownerId: "alice" });
    const other = await policy.canPublish(
      { provider: "gitlab", owner: "alice", repository: null },
      "@team/b",
    );
    expect(other.ok).toBe(false);
  });
});
