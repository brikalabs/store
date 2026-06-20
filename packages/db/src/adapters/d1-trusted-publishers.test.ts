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
  const gh = {
    scope: "@brika",
    provider: "github",
    repository: "brikalabs/weather",
    workflow: "publish.yml",
  };

  test("add is idempotent and listForScope returns the bindings", async () => {
    await store.add(gh);
    await store.add(gh);
    expect(await store.listForScope("@brika")).toEqual([gh]);
  });

  test("a gitlab binding for the same repo is distinct from the github one", async () => {
    await store.add(gh);
    await store.add({ ...gh, provider: "gitlab", workflow: ".gitlab-ci.yml" });
    expect(await store.listForScope("@brika")).toHaveLength(2);
  });

  test("listForScope is scoped (a different scope sees nothing)", async () => {
    await store.add(gh);
    expect(await store.listForScope("@other")).toEqual([]);
  });

  test("remove deletes a binding and reports whether one was removed", async () => {
    await store.add(gh);
    expect(await store.remove("@brika", "github", "brikalabs/weather", "publish.yml")).toBe(true);
    expect(await store.remove("@brika", "github", "brikalabs/weather", "publish.yml")).toBe(false);
    expect(await store.listForScope("@brika")).toEqual([]);
  });
});
