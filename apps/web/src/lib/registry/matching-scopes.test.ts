import { describe, expect, test } from "bun:test";
import { PluginSummary } from "@brika/registry-contract";
import { groupByScope, matchingScopes, topScopes } from "./matching-scopes";

const plugin = (
  name: string,
  opts: { weekly?: number; authorName?: string; verified?: boolean } = {},
) =>
  PluginSummary.parse({
    name,
    version: "1.0.0",
    brikaEngine: "*",
    downloadsWeekly: opts.weekly ?? 0,
    author: opts.authorName
      ? { id: "u", name: opts.authorName, verified: opts.verified ?? false }
      : undefined,
  });

describe("groupByScope", () => {
  test("aggregates count + weekly installs + publisher per scope, skipping unscoped names", () => {
    const result = groupByScope([
      plugin("@acme/a", { weekly: 5, authorName: "Acme", verified: true }),
      plugin("@acme/b", { weekly: 3 }),
      plugin("loose", { weekly: 9 }),
    ]);
    expect(result).toEqual([{ scope: "@acme", name: "Acme", count: 2, weekly: 8, verified: true }]);
  });

  test("publisher name + verified fall back when the author is absent", () => {
    expect(groupByScope([plugin("@x/a")])[0]).toMatchObject({ name: "@x", verified: false });
  });
});

describe("topScopes", () => {
  test("orders by plugin count descending and caps at the limit", () => {
    const plugins = [
      plugin("@a/1"),
      plugin("@a/2"),
      plugin("@b/1"),
      plugin("@c/1"),
      plugin("@c/2"),
      plugin("@c/3"),
    ];
    expect(topScopes(plugins, 2).map((s) => s.scope)).toEqual(["@c", "@a"]);
  });
});

describe("matchingScopes", () => {
  const plugins = [
    plugin("@acme/a", { authorName: "Acme Labs" }),
    plugin("@acme/b"),
    plugin("@other/x"),
  ];

  test("matches the scope slug case-insensitively", () => {
    expect(matchingScopes(plugins, "ACME").map((s) => s.scope)).toEqual(["@acme"]);
  });

  test("matches the publisher display name too", () => {
    expect(matchingScopes(plugins, "labs").map((s) => s.scope)).toEqual(["@acme"]);
  });

  test("returns nothing when neither slug nor name matches", () => {
    expect(matchingScopes(plugins, "zzz")).toEqual([]);
  });
});
