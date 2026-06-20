import { describe, expect, test } from "bun:test";
import { manageStatus, orgStatus } from "@/lib/http";

describe("orgStatus", () => {
  test("maps OrgResult codes to HTTP statuses", () => {
    expect(orgStatus("not_found")).toBe(404);
    expect(orgStatus("conflict")).toBe(409);
    expect(orgStatus("too_many")).toBe(429);
    expect(orgStatus("forbidden")).toBe(403);
  });
});

describe("manageStatus", () => {
  test("maps ManageResult codes to HTTP statuses", () => {
    expect(manageStatus("not_found")).toBe(404);
    expect(manageStatus("forbidden")).toBe(403);
  });
});
