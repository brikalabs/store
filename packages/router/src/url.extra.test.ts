import { describe, expect, test } from "bun:test";
import { link } from "./url";

/**
 * Edge cases of the typed URL builder: a missing required param yields an empty
 * segment, an absent optional param drops its segment, and `{regex}` constraints
 * do not change the param key used to look up a value.
 */

describe("link edge cases", () => {
  test("a missing required param yields an empty segment", () => {
    // The pattern declares :id but no value is supplied at runtime: the segment is
    // emitted empty rather than dropped, leaving a visible gap in the path.
    const params: { id?: string } = {};
    expect(link("/users/:id", params)).toBe("/users/");
  });

  test("an absent optional param drops its whole segment", () => {
    expect(link("/files/:dir?/:name", { name: "a.txt" })).toBe("/files/a.txt");
    expect(link("/files/:dir?/:name", { dir: "src", name: "a.txt" })).toBe("/files/src/a.txt");
  });

  test("a present optional param is encoded like a required one", () => {
    expect(link("/q/:term?", { term: "a b" })).toBe("/q/a%20b");
  });

  test("a constrained param resolves by its bare key, ignoring the {regex}", () => {
    expect(link("/n/:id{[0-9]+}", { id: "42" })).toBe("/n/42");
    // The constraint uses `\x2f` rather than a literal `/` so the pattern still
    // tokenizes by splitting on `/`, matching how the npm preset writes it.
    expect(link("/s/:scope{@[^\\x2f]+}?", { scope: "@brika" })).toBe("/s/%40brika");
  });

  test("static-only patterns pass through unchanged", () => {
    expect(link("/", {})).toBe("/");
  });
});
