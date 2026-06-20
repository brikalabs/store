import { describe, expect, test } from "bun:test";
import { manageStatus, scopeStatus } from "./http";

describe("scopeStatus", () => {
  test("maps ScopeResult codes to HTTP statuses", () => {
    expect(scopeStatus("not_found")).toBe(404);
    expect(scopeStatus("conflict")).toBe(409);
    expect(scopeStatus("forbidden")).toBe(403);
  });
});

describe("manageStatus", () => {
  test("maps ManageResult codes to HTTP statuses", () => {
    expect(manageStatus("not_found")).toBe(404);
    expect(manageStatus("forbidden")).toBe(403);
  });
});
