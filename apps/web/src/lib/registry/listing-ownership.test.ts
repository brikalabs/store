import { describe, expect, test } from "bun:test";
import { isListingMaintainer } from "@/lib/registry/listing";

describe("isListingMaintainer (CONSOLE-005-AC3 ownership gate)", () => {
  test("CONSOLE-005-AC3: registry scope requires membership", () => {
    expect(
      isListingMaintainer({ scope: "@acme", memberScopes: ["@acme"], maintainers: [], login: "a" }),
    ).toBe(true);
    expect(
      isListingMaintainer({
        scope: "@acme",
        memberScopes: ["@other"],
        maintainers: [],
        login: "a",
      }),
    ).toBe(false);
  });

  test("CONSOLE-005-AC3: npm package requires being a maintainer", () => {
    expect(
      isListingMaintainer({
        scope: null,
        memberScopes: [],
        maintainers: ["alice"],
        login: "alice",
      }),
    ).toBe(true);
    expect(
      isListingMaintainer({ scope: null, memberScopes: [], maintainers: ["bob"], login: "alice" }),
    ).toBe(false);
  });
});
