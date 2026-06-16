import { describe, expect, test } from "bun:test";
import { link } from "./url";

describe("link", () => {
  test("substitutes params, encoding with encodeURIComponent by default", () => {
    expect(link("/users/:id", { id: "42" })).toBe("/users/42");
    expect(link("/q/:term", { term: "a b" })).toBe("/q/a%20b");
    expect(link("/health", {})).toBe("/health");
  });

  test("accepts a custom encoder for a given key", () => {
    const encode = (key: string, value: string) =>
      key === "name" ? value.replace("/", "%2F") : value;
    expect(link("/p/:name", { name: "@s/p" }, encode)).toBe("/p/@s%2Fp");
  });
});
