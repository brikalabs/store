import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { makeDb } from "../test-harness";
import { D1ScopeStore } from "./d1-scope-store";

let db: Db;
let store: D1ScopeStore;
beforeEach(() => {
  db = makeDb();
  store = new D1ScopeStore(db);
});

describe("D1ScopeStore.countOwnedBy", () => {
  test("counts only the scopes created by the given identity", async () => {
    const alice = { provider: "github", id: "alice" };
    await store.claim("@a", alice);
    await store.claim("@b", alice);
    await store.claim("@c", { provider: "github", id: "bob" });

    expect(await store.countOwnedBy(alice)).toBe(2);
    expect(await store.countOwnedBy({ provider: "github", id: "bob" })).toBe(1);
    expect(await store.countOwnedBy({ provider: "github", id: "nobody" })).toBe(0);
  });
});
