import { describe, expect, test } from "bun:test";
import { ftsMatch } from "./fts";

describe("ftsMatch", () => {
  test("turns each word into a quoted prefix token, AND-combined", () => {
    expect(ftsMatch("map geo")).toBe('"map"* "geo"*');
    expect(ftsMatch("  Maps  ")).toBe('"maps"*');
  });

  test("neutralizes FTS operators and punctuation (no injection)", () => {
    // `OR`, `*`, quotes and `:` are quoted as literals, never parsed as FTS syntax.
    expect(ftsMatch("foo OR bar")).toBe('"foo"* "or"* "bar"*');
    expect(ftsMatch('a" OR x:*')).toBe('"a"* "or"* "x"*');
  });

  test("is null when there is nothing to match", () => {
    expect(ftsMatch("")).toBeNull();
    expect(ftsMatch("   ")).toBeNull();
    expect(ftsMatch('":*"')).toBeNull();
  });
});
