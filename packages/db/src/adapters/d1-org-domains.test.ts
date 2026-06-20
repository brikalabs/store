import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regOrgs } from "../schema";
import { makeDb } from "../test-harness";
import { D1OrgDomains } from "./d1-org-domains";

/** D1 adapter tests for org domain claims + verification state (ORG-010). */

let db: Db;
let domains: D1OrgDomains;
beforeEach(async () => {
  db = makeDb();
  domains = new D1OrgDomains(db);
  await db.insert(regOrgs).values([{ slug: "acme" }, { slug: "other" }]);
});

describe("D1OrgDomains", () => {
  test("add is idempotent and starts unverified; get/list reflect it", async () => {
    expect(await domains.add("acme", "brika.dev")).toEqual({
      domain: "brika.dev",
      verified: false,
    });
    await domains.add("acme", "brika.dev"); // idempotent
    expect(await domains.get("acme", "brika.dev")).toEqual({
      domain: "brika.dev",
      verified: false,
    });
    expect(await domains.list("acme")).toHaveLength(1);
  });

  test("setVerified flips the flag both ways; remove reports whether it applied", async () => {
    await domains.add("acme", "brika.dev");
    await domains.setVerified("acme", "brika.dev", true);
    expect((await domains.get("acme", "brika.dev"))?.verified).toBe(true);
    await domains.setVerified("acme", "brika.dev", false);
    expect((await domains.get("acme", "brika.dev"))?.verified).toBe(false);
    expect(await domains.remove("acme", "brika.dev")).toBe(true);
    expect(await domains.remove("acme", "brika.dev")).toBe(false);
    expect(await domains.get("acme", "brika.dev")).toBeNull();
  });

  test("listAllVerified returns only verified domains, across all orgs", async () => {
    await domains.add("acme", "brika.dev");
    await domains.add("acme", "pending.dev");
    await domains.add("other", "other.dev");
    await domains.setVerified("acme", "brika.dev", true);
    await domains.setVerified("other", "other.dev", true);
    expect(await domains.listAllVerified()).toEqual([
      { orgSlug: "acme", domain: "brika.dev" },
      { orgSlug: "other", domain: "other.dev" },
    ]);
  });
});
