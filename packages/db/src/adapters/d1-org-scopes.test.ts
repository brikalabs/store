import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regOrgs } from "../schema";
import { makeDb } from "../test-harness";
import { D1OrgScopes } from "./d1-org-scopes";

/** D1 adapter tests for the 1:N org <-> scopes link (ORG-002). */

let db: Db;
let scopes: D1OrgScopes;
beforeEach(async () => {
  db = makeDb();
  scopes = new D1OrgScopes(db);
  await db.insert(regOrgs).values([{ slug: "acme" }, { slug: "other" }]);
});

describe("D1OrgScopes", () => {
  test("attach links a scope to an org and is idempotent", async () => {
    expect(await scopes.attach("@acme", "acme")).toEqual({ scope: "@acme", orgSlug: "acme" });
    expect(await scopes.attach("@acme", "acme")).toEqual({ scope: "@acme", orgSlug: "acme" });
    expect(await scopes.orgForScope("@acme")).toBe("acme");
  });

  test("ORG-002-AC3: attaching a scope already owned by another org keeps the first owner", async () => {
    await scopes.attach("@shared", "acme");
    // The attach returns the CURRENT owner (acme), so the caller detects the conflict.
    expect(await scopes.attach("@shared", "other")).toEqual({ scope: "@shared", orgSlug: "acme" });
    expect(await scopes.orgForScope("@shared")).toBe("acme");
  });

  test("scopesForOrg lists every scope an org owns (1:N), sorted; orgForScope is null when unattached", async () => {
    await scopes.attach("@acme-labs", "acme");
    await scopes.attach("@acme", "acme");
    await scopes.attach("@other", "other");
    expect(await scopes.scopesForOrg("acme")).toEqual(["@acme", "@acme-labs"]);
    expect(await scopes.scopesForOrg("other")).toEqual(["@other"]);
    expect(await scopes.orgForScope("@unknown")).toBeNull();
  });
});
