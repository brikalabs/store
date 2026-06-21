import { describe, expect, test } from "bun:test";
import { isOperator, parseOperatorAdmins } from "./operators";

describe("parseOperatorAdmins", () => {
  test("trims entries and drops blanks", () => {
    const admins = parseOperatorAdmins(" usr_octo , usr_alice ,, ");
    expect([...admins].sort()).toEqual(["usr_alice", "usr_octo"]);
  });

  test("an empty value yields no operators (fail closed)", () => {
    expect(parseOperatorAdmins("").size).toBe(0);
    expect(parseOperatorAdmins("   ").size).toBe(0);
  });
});

describe("isOperator", () => {
  const admins = parseOperatorAdmins("usr_octo,usr_alice");

  test("matches an account id in the allowlist", () => {
    expect(isOperator(admins, { userId: "usr_octo" })).toBe(true);
    expect(isOperator(admins, { userId: "usr_alice" })).toBe(true);
  });

  test("does not match an unknown account, or a CI credential (no account)", () => {
    expect(isOperator(admins, { userId: "usr_stranger" })).toBe(false);
    expect(isOperator(admins, { userId: null })).toBe(false);
  });
});
