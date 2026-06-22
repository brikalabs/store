import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { makeAdapter, makeDb } from "../test-harness";
import { D1ScopeMembers } from "./d1-scope-members";
import { D1ScopeStore } from "./d1-scope-store";

/** D1 adapter tests for the scope store + the scope-count used by the per-account cap. */

let db: Db;
let store: D1ScopeStore;
let members: D1ScopeMembers;
beforeEach(() => {
  db = makeDb();
  store = makeAdapter(db, D1ScopeStore);
  members = makeAdapter(db, D1ScopeMembers);
});

describe("D1ScopeStore", () => {
  test("claim creates the scope once and reports who created it", async () => {
    const first = await store.claim("@acme");
    expect(first).toMatchObject({ created: true, record: { scope: "@acme", displayName: null } });
    const second = await store.claim("@acme");
    expect(second.created).toBe(false);
    expect(second.record.scope).toBe("@acme");
  });

  test("get returns null for an unknown scope and the record for a known one", async () => {
    expect(await store.get("@nope")).toBeNull();
    await store.claim("@acme");
    expect(await store.get("@acme")).toEqual({
      scope: "@acme",
      displayName: null,
      description: null,
      links: [],
      iconKey: null,
      takedown: null,
    });
  });

  test("setDisplayName updates and clears the label", async () => {
    await store.claim("@acme");
    await store.setDisplayName("@acme", "Acme Inc");
    expect((await store.get("@acme"))?.displayName).toBe("Acme Inc");
    await store.setDisplayName("@acme", null);
    expect((await store.get("@acme"))?.displayName).toBeNull();
  });

  test("setProfile + setIcon round-trip description, links, and the icon key", async () => {
    await store.claim("@acme");
    const links = [{ label: "X", url: "https://x.com/acme" }];
    await store.setProfile("@acme", { description: "Plugins for hubs", links });
    await store.setIcon("@acme", "scope-icons/acme.png");
    expect(await store.get("@acme")).toMatchObject({
      description: "Plugins for hubs",
      links,
      iconKey: "scope-icons/acme.png",
    });
  });

  test("listAll returns every scope (for the operator directory), including taken-down ones", async () => {
    await store.claim("@acme");
    await store.claim("@beta");
    await store.setTakedown("@beta", "squatting");
    const all = await store.listAll();
    expect(all.map((o) => o.scope).sort()).toEqual(["@acme", "@beta"]);
    expect(all.find((o) => o.scope === "@beta")?.takedown).toBe("squatting");
  });

  test("setTakedown records the reason and clears it on restore (ORG-007)", async () => {
    await store.claim("@acme");
    await store.setTakedown("@acme", "name-squatting");
    expect((await store.get("@acme"))?.takedown).toBe("name-squatting");
    await store.setTakedown("@acme", null);
    expect((await store.get("@acme"))?.takedown).toBeNull();
  });
});

describe("D1ScopeMembers.countScopesAdminedBy", () => {
  test("counts only scopes the identity is an admin of (per-account cap input)", async () => {
    await store.claim("@a");
    await store.claim("@b");
    await store.claim("@c");
    await members.upsert("@a", "alice", "admin");
    await members.upsert("@b", "alice", "admin");
    await members.upsert("@c", "alice", "member"); // not admin
    expect(await members.countScopesAdminedBy("alice")).toBe(2);
    expect(await members.countScopesAdminedBy("nobody")).toBe(0);
  });
});
