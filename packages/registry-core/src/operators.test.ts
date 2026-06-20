import { describe, expect, test } from "bun:test";
import { isOperator, operatorKey, parseOperatorAdmins } from "./operators";

describe("parseOperatorAdmins", () => {
  test("qualifies bare entries with github and trims/drops blanks", () => {
    const admins = parseOperatorAdmins(" octocat , gitlab:alice ,, ");
    expect([...admins].sort()).toEqual(["github:octocat", "gitlab:alice"]);
  });

  test("an empty value yields no operators (fail closed)", () => {
    expect(parseOperatorAdmins("").size).toBe(0);
    expect(parseOperatorAdmins("   ").size).toBe(0);
  });
});

describe("isOperator", () => {
  const admins = parseOperatorAdmins("octocat,gitlab:alice");

  test("matches a provider-qualified identity", () => {
    expect(isOperator(admins, { provider: "github", owner: "octocat" })).toBe(true);
    expect(isOperator(admins, { provider: "gitlab", owner: "alice" })).toBe(true);
  });

  test("does not match across providers or for unknown owners", () => {
    expect(isOperator(admins, { provider: "gitlab", owner: "octocat" })).toBe(false);
    expect(isOperator(admins, { provider: "github", owner: "stranger" })).toBe(false);
  });

  test("operatorKey is the provider:owner shape the allowlist stores", () => {
    expect(operatorKey({ provider: "github", owner: "octocat" })).toBe("github:octocat");
  });
});
