import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regOrgs, regScopes } from "../schema";
import { makeDb } from "../test-harness";
import { D1TrustedPublishers } from "./d1-trusted-publishers";

let db: Db;
let store: D1TrustedPublishers;
beforeEach(async () => {
  db = makeDb();
  store = new D1TrustedPublishers(db);
  // A binding's scope FK must exist (reg_scopes -> reg_orgs).
  await db.insert(regOrgs).values({ slug: "brika" });
  await db.insert(regScopes).values({ scope: "@brika", orgId: "brika" });
});

describe("D1TrustedPublishers", () => {
  test("add is idempotent and listForScope returns the bindings", async () => {
    await store.add({ scope: "@brika", repository: "brikalabs/weather", workflow: "publish.yml" });
    await store.add({ scope: "@brika", repository: "brikalabs/weather", workflow: "publish.yml" });
    const list = await store.listForScope("@brika");
    expect(list).toEqual([
      { scope: "@brika", repository: "brikalabs/weather", workflow: "publish.yml" },
    ]);
  });

  test("listForScope is scoped (a different scope sees nothing)", async () => {
    await store.add({ scope: "@brika", repository: "brikalabs/weather", workflow: "publish.yml" });
    expect(await store.listForScope("@other")).toEqual([]);
  });

  test("remove deletes a binding and reports whether one was removed", async () => {
    await store.add({ scope: "@brika", repository: "brikalabs/weather", workflow: "publish.yml" });
    expect(await store.remove("@brika", "brikalabs/weather", "publish.yml")).toBe(true);
    expect(await store.remove("@brika", "brikalabs/weather", "publish.yml")).toBe(false);
    expect(await store.listForScope("@brika")).toEqual([]);
  });
});
