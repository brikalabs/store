import { describe, expect, test } from "bun:test";
import { isCanonicalName, isCanonicalScope, ownedBy, scopeOf } from "./names";

describe("scopeOf", () => {
  test("returns the @scope segment, or null when unscoped", () => {
    expect(scopeOf("@brika/plugin-x")).toBe("@brika");
    expect(scopeOf("lodash")).toBeNull();
    expect(scopeOf("@brika")).toBe("@brika"); // no slash yet
  });
});

describe("isCanonicalScope (JSR-style)", () => {
  test("accepts 2-20 lowercase letters/digits/hyphens, no leading hyphen", () => {
    expect(isCanonicalScope("@brika")).toBe(true);
    expect(isCanonicalScope("@my-team")).toBe(true);
    expect(isCanonicalScope("@a1")).toBe(true);
  });

  test("rejects too short, leading hyphen, uppercase, non-ASCII, too long, missing @", () => {
    expect(isCanonicalScope("@a")).toBe(false); // 1 char after @
    expect(isCanonicalScope("@-team")).toBe(false); // leading hyphen
    expect(isCanonicalScope("@Brika")).toBe(false); // uppercase
    expect(isCanonicalScope("@brіka")).toBe(false); // Cyrillic i
    expect(isCanonicalScope(`@${"a".repeat(21)}`)).toBe(false); // 21 > 20
    expect(isCanonicalScope("brika")).toBe(false); // no @
    expect(isCanonicalScope("@brika/x")).toBe(false); // a scope is not a package name
  });
});

describe("isCanonicalName", () => {
  test("accepts a scoped lowercase a-z0-9- name", () => {
    expect(isCanonicalName("@brika/plugin-x")).toBe(true);
    expect(isCanonicalName("@my-team/x")).toBe(true);
  });

  test("uses the same charset as the manifest schema (no '.' or '_')", () => {
    // These pass nowhere-else confusion: the registry rule matches @brika/schema's
    // name charset, so a name is never accepted here only to be rejected by the gate.
    expect(isCanonicalName("@brika/plugin.x")).toBe(false);
    expect(isCanonicalName("@brika/plugin_x")).toBe(false);
  });

  test("rejects unscoped, uppercase, bad scope, and over-long names", () => {
    expect(isCanonicalName("lodash")).toBe(false); // unscoped
    expect(isCanonicalName("@Brika/x")).toBe(false); // uppercase scope
    expect(isCanonicalName("@-team/x")).toBe(false); // leading-hyphen scope
    expect(isCanonicalName(`@brika/${"a".repeat(210)}`)).toBe(false); // > 214 total
  });
});

describe("ownedBy", () => {
  const identity = { provider: "github", owner: "alice", repository: null };
  test("matches only when both provider and owner id agree", () => {
    expect(ownedBy({ ownerProvider: "github", ownerId: "alice" }, identity)).toBe(true);
    expect(ownedBy({ ownerProvider: "github", ownerId: "bob" }, identity)).toBe(false);
    expect(ownedBy({ ownerProvider: "gitlab", ownerId: "alice" }, identity)).toBe(false);
  });
});
