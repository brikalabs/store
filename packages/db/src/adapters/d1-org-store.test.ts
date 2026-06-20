import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { makeDb } from "../test-harness";
import { D1OrgMembers } from "./d1-org-members";
import { D1OrgStore } from "./d1-org-store";

/** D1 adapter tests for the org store + the org-count used by the per-account cap. */

let db: Db;
let store: D1OrgStore;
let members: D1OrgMembers;
beforeEach(() => {
  db = makeDb();
  store = new D1OrgStore(db);
  members = new D1OrgMembers(db);
});

describe("D1OrgStore", () => {
  test("claim creates the org once and reports who created it", async () => {
    const first = await store.claim("acme");
    expect(first).toMatchObject({ created: true, record: { slug: "acme", displayName: null } });
    const second = await store.claim("acme");
    expect(second.created).toBe(false);
    expect(second.record.slug).toBe("acme");
  });

  test("get returns null for an unknown org and the record for a known one", async () => {
    expect(await store.get("nope")).toBeNull();
    await store.claim("acme");
    expect(await store.get("acme")).toEqual({
      slug: "acme",
      displayName: null,
      description: null,
      links: [],
      iconKey: null,
      takedown: null,
    });
  });

  test("setDisplayName updates and clears the label", async () => {
    await store.claim("acme");
    await store.setDisplayName("acme", "Acme Inc");
    expect((await store.get("acme"))?.displayName).toBe("Acme Inc");
    await store.setDisplayName("acme", null);
    expect((await store.get("acme"))?.displayName).toBeNull();
  });

  test("setProfile + setIcon round-trip description, links, and the icon key", async () => {
    await store.claim("acme");
    const links = [{ label: "X", url: "https://x.com/acme" }];
    await store.setProfile("acme", { description: "Plugins for hubs", links });
    await store.setIcon("acme", "org-icons/acme.png");
    expect(await store.get("acme")).toMatchObject({
      description: "Plugins for hubs",
      links,
      iconKey: "org-icons/acme.png",
    });
  });

  test("setTakedown records the reason and clears it on restore (ORG-007)", async () => {
    await store.claim("acme");
    await store.setTakedown("acme", "name-squatting");
    expect((await store.get("acme"))?.takedown).toBe("name-squatting");
    await store.setTakedown("acme", null);
    expect((await store.get("acme"))?.takedown).toBeNull();
  });
});

describe("D1OrgMembers.countOrgsAdminedBy", () => {
  test("counts only orgs the identity is an admin of (per-account cap input)", async () => {
    await store.claim("a");
    await store.claim("b");
    await store.claim("c");
    await members.upsert("a", { provider: "github", id: "alice" }, "admin");
    await members.upsert("b", { provider: "github", id: "alice" }, "admin");
    await members.upsert("c", { provider: "github", id: "alice" }, "member"); // not admin
    expect(await members.countOrgsAdminedBy({ provider: "github", id: "alice" })).toBe(2);
    expect(await members.countOrgsAdminedBy({ provider: "github", id: "nobody" })).toBe(0);
  });
});
