import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regScopes } from "../schema";
import { makeAdapter, makeDb } from "../test-harness";
import { D1TrustedPublishers } from "./d1-trusted-publishers";

let db: Db;
let store: D1TrustedPublishers;
beforeEach(async () => {
  db = makeDb();
  store = makeAdapter(db, D1TrustedPublishers);
  // A binding's scope FK must exist (reg_trusted_publishers -> reg_scopes).
  await db.insert(regScopes).values({ scope: "@brika" });
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
