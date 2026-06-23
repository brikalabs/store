import { describe, expect, test } from "bun:test";
import { isNameValid, MAX_NAME, probeToCheck } from "./use-name-check";

describe("probeToCheck", () => {
  test("a null (failed) probe falls back to ok", () => {
    expect(probeToCheck(null)).toBe("ok");
  });

  test("an invalid name is invalid", () => {
    expect(probeToCheck({ valid: false, available: false })).toBe("invalid");
  });

  test("a valid but unavailable name is taken", () => {
    expect(probeToCheck({ valid: true, available: false })).toBe("taken");
  });

  test("a valid available name is ok", () => {
    expect(probeToCheck({ valid: true, available: true })).toBe("ok");
  });
});

describe("isNameValid", () => {
  test("accepts a lowercase name under the length cap", () => {
    expect(isNameValid("@acme", "my-plugin")).toBe(true);
  });

  test("rejects uppercase, a leading dash, and empty", () => {
    expect(isNameValid("@acme", "My-Plugin")).toBe(false);
    expect(isNameValid("@acme", "-plugin")).toBe(false);
    expect(isNameValid("@acme", "")).toBe(false);
  });

  test("rejects when scope/name exceeds MAX_NAME", () => {
    const name = "a".repeat(MAX_NAME);
    expect(isNameValid("@acme", name)).toBe(false);
  });
});
