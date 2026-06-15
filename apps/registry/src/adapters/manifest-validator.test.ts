import { expect, test } from "bun:test";
import { SchemaManifestValidator } from "./manifest-validator";

const validator = new SchemaManifestValidator();

const valid = {
  name: "@brika/plugin-x",
  version: "1.2.3",
  main: "./src/index.ts",
  engines: { brika: "^0.4.0" },
  icon: "./icon.svg",
  displayName: "Plugin X",
  description: "Does a thing",
};

test("accepts a complete plugin manifest", () => {
  expect(validator.validate(valid)).toEqual({ ok: true });
});

test("requires an icon", () => {
  const result = validator.validate({ ...valid, icon: "" });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("icon");
});

test("requires a title (displayName)", () => {
  const { displayName, ...withoutTitle } = valid;
  void displayName;
  const result = validator.validate(withoutTitle);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("displayName");
});

test("requires a description", () => {
  const { description, ...withoutDescription } = valid;
  void description;
  expect(validator.validate(withoutDescription).ok).toBe(false);
});

test("requires the brika engine", () => {
  const { engines, ...withoutEngine } = valid;
  void engines;
  expect(validator.validate(withoutEngine).ok).toBe(false);
});

test("requires a main entrypoint", () => {
  const { main, ...withoutMain } = valid;
  void main;
  const result = validator.validate(withoutMain);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("main");
});

test("rejects a non-semver version", () => {
  const result = validator.validate({ ...valid, version: "latest" });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("version");
});

test("rejects an icon path that escapes the package root", () => {
  const result = validator.validate({ ...valid, icon: "../../etc/passwd" });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("icon");
});
