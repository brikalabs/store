import { describe, expect, test } from "bun:test";
import { callerFrame, frameLocation, moduleFile } from "./index";

describe("frameLocation", () => {
  test("parses the V8 parenthesized form and strips file://", () => {
    expect(frameLocation("    at fn (/app/src/router.ts:41:14)")).toBe("/app/src/router.ts:41:14");
    expect(frameLocation("    at file:///app/src/di.ts:1:2")).toBe("/app/src/di.ts:1:2");
  });

  test("returns undefined for a frame with no location", () => {
    expect(frameLocation("Error: boom")).toBeUndefined();
  });
});

describe("moduleFile", () => {
  const stack = [
    "Error: probe",
    "    at moduleFile (/app/packages/stack/src/index.ts:20:5)",
    "    at /app/src/router.ts:163:30",
    "    at node:internal/x:1:1",
  ].join("\n");

  test("returns the first non-node frame's file with line:col stripped", () => {
    expect(moduleFile(stack)).toBe("/app/packages/stack/src/index.ts");
  });

  test("returns '' when no usable frame exists", () => {
    expect(moduleFile(undefined)).toBe("");
    expect(moduleFile("Error\n    at node:internal/y:2:2")).toBe("");
  });
});

describe("callerFrame", () => {
  const stack = [
    "Error",
    "    at callerSource (/app/src/router.ts:172:17)",
    "    at defineRoute (/app/src/router.ts:212:5)",
    "    at /app/src/routes/packages.ts:8:30",
  ].join("\n");

  test("returns the first frame outside selfFile", () => {
    expect(callerFrame(stack, "/app/src/router.ts")).toBe("/app/src/routes/packages.ts:8:30");
  });

  test("returns undefined when every frame is selfFile/node", () => {
    expect(
      callerFrame("Error\n    at /app/src/router.ts:1:1", "/app/src/router.ts"),
    ).toBeUndefined();
  });
});
