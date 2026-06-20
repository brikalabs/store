import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regScopes } from "../schema";
import { makeDb } from "../test-harness";
import { D1ScopeDomains } from "./d1-scope-domains";

/** D1 adapter tests for scope domain claims + verification state (ORG-010). */

let db: Db;
let domains: D1ScopeDomains;
beforeEach(async () => {
  db = makeDb();
  domains = new D1ScopeDomains(db);
  await db.insert(regScopes).values([{ scope: "@acme" }, { scope: "@other" }]);
});

describe("D1ScopeDomains", () => {
  test("add is idempotent and starts unverified; get/list reflect it", async () => {
    expect(await domains.add("@acme", "brika.dev")).toEqual({
      domain: "brika.dev",
      verified: false,
    });
    await domains.add("@acme", "brika.dev"); // idempotent
    expect(await domains.get("@acme", "brika.dev")).toEqual({
      domain: "brika.dev",
      verified: false,
    });
    expect(await domains.list("@acme")).toHaveLength(1);
  });

  test("setVerified flips the flag both ways; remove reports whether it applied", async () => {
    await domains.add("@acme", "brika.dev");
    await domains.setVerified("@acme", "brika.dev", true);
    expect((await domains.get("@acme", "brika.dev"))?.verified).toBe(true);
    await domains.setVerified("@acme", "brika.dev", false);
    expect((await domains.get("@acme", "brika.dev"))?.verified).toBe(false);
    expect(await domains.remove("@acme", "brika.dev")).toBe(true);
    expect(await domains.remove("@acme", "brika.dev")).toBe(false);
    expect(await domains.get("@acme", "brika.dev")).toBeNull();
  });

  test("listAllVerified returns only verified domains, across all scopes", async () => {
    await domains.add("@acme", "brika.dev");
    await domains.add("@acme", "pending.dev");
    await domains.add("@other", "other.dev");
    await domains.setVerified("@acme", "brika.dev", true);
    await domains.setVerified("@other", "other.dev", true);
    expect(await domains.listAllVerified()).toEqual([
      { scope: "@acme", domain: "brika.dev" },
      { scope: "@other", domain: "other.dev" },
    ]);
  });
});
