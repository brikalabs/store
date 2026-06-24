import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { makeAdapter, makeDb } from "../test-harness";
import { D1ScopeMembers } from "./d1-scope-members";
import { D1ScopeStore } from "./d1-scope-store";

/** D1 adapter tests for scope membership: the last-admin invariant, removal, and role lookup. */

let db: Db;
let store: D1ScopeStore;
let members: D1ScopeMembers;
beforeEach(() => {
  db = makeDb();
  store = makeAdapter(db, D1ScopeStore);
  members = makeAdapter(db, D1ScopeMembers);
});

describe("D1ScopeMembers", () => {
  test("demoteFromAdmin keeps the role admin and returns false for the last admin", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "admin");

    expect(await members.demoteFromAdmin("@acme", "alice")).toBe(false);
    expect(await members.roleOf("@acme", "alice")).toBe("admin");
  });

  test("demoteFromAdmin sets the role to member and returns true when another admin remains", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "admin");
    await members.upsert("@acme", "bob", "admin");

    expect(await members.demoteFromAdmin("@acme", "alice")).toBe(true);
    expect(await members.roleOf("@acme", "alice")).toBe("member");
    expect(await members.roleOf("@acme", "bob")).toBe("admin");
  });

  test("remove keeps the row and returns false for the last admin", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "admin");

    expect(await members.remove("@acme", "alice")).toBe(false);
    expect(await members.roleOf("@acme", "alice")).toBe("admin");
  });

  test("remove deletes the row and returns true when the admin is not the last", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "admin");
    await members.upsert("@acme", "bob", "admin");

    expect(await members.remove("@acme", "alice")).toBe(true);
    expect(await members.roleOf("@acme", "alice")).toBeNull();
    expect(await members.roleOf("@acme", "bob")).toBe("admin");
  });

  test("remove deletes a plain member and returns true regardless of admin count", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "admin");
    await members.upsert("@acme", "carol", "member");

    expect(await members.remove("@acme", "carol")).toBe(true);
    expect(await members.roleOf("@acme", "carol")).toBeNull();
    expect(await members.roleOf("@acme", "alice")).toBe("admin");
  });

  test("roleOf returns null for a non-member and the stored role for a member", async () => {
    await store.claim("@acme");
    await members.upsert("@acme", "alice", "member");

    expect(await members.roleOf("@acme", "stranger")).toBeNull();
    expect(await members.roleOf("@acme", "alice")).toBe("member");
  });
});
