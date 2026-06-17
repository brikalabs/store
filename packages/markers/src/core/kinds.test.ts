import { describe, expect, test } from "bun:test";
import { KINDS, kindByName } from "./kinds";

describe("kindByName", () => {
  test("finds a registered kind, undefined otherwise", () => {
    expect(kindByName("mock")?.title).toBe("Mock data");
    expect(kindByName("nope")).toBeUndefined();
  });

  test("every default kind is well-formed", () => {
    for (const kind of KINDS) {
      expect(kind.name).toMatch(/^[a-z]+$/);
      expect(kind.title.length).toBeGreaterThan(0);
      expect(kind.description.length).toBeGreaterThan(0);
    }
  });
});
