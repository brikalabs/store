import { describe, expect, test } from "bun:test";
import { resolveKinds } from "./config";
import { KINDS } from "./kinds";

describe("resolveKinds", () => {
  test("returns the built-in defaults with no config", () => {
    expect(resolveKinds()).toEqual([...KINDS]);
    expect(resolveKinds(null)).toEqual([...KINDS]);
    expect(resolveKinds("   ")).toEqual([...KINDS]);
  });

  test("overlays a default kind by name without adding one", () => {
    const json = JSON.stringify({
      kinds: [{ name: "mock", description: "new desc", severity: "warning" }],
    });
    const kinds = resolveKinds(json);
    expect(kinds).toHaveLength(KINDS.length);
    expect(kinds.find((kind) => kind.name === "mock")).toMatchObject({
      description: "new desc",
      severity: "warning",
    });
  });

  test("appends a new kind and derives a title and default severity", () => {
    const json = JSON.stringify({
      kinds: [{ name: "security", description: "close before ship" }],
    });
    const kinds = resolveKinds(json);
    expect(kinds).toHaveLength(KINDS.length + 1);
    expect(kinds.at(-1)).toMatchObject({ name: "security", title: "Security", severity: "info" });
  });

  test("rejects an invalid kind name", () => {
    const json = JSON.stringify({ kinds: [{ name: "Bad Name", description: "x" }] });
    expect(() => resolveKinds(json)).toThrow();
  });
});
