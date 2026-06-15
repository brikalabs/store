import { describe, expect, test } from "bun:test";
import { parseCommandArgs } from "./args";
import { CliError } from "./errors";

describe("parseCommandArgs", () => {
  test("reads an optional positional", () => {
    expect(parseCommandArgs(["/dir"], []).positional).toBe("/dir");
    expect(parseCommandArgs([], []).positional).toBeUndefined();
  });

  test("tracks allowed flags only", () => {
    const args = parseCommandArgs(["--dry-run"], ["--dry-run"]);
    expect(args.has("--dry-run")).toBe(true);
    expect(args.has("-n")).toBe(false);
  });

  test("rejects unknown flags", () => {
    expect(() => parseCommandArgs(["--nope"], ["--dry-run"])).toThrow(CliError);
  });

  test("rejects extra positionals", () => {
    expect(() => parseCommandArgs(["a", "b"], [])).toThrow(CliError);
  });
});
