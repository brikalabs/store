import { expect, test } from "bun:test";
import { PluginPackageSchema } from "./plugin";

const base = {
  name: "@brika/plugin-x",
  version: "1.2.3",
  main: "./src/index.ts",
  engines: { brika: "^0.4.0" },
};

test("accepts a minimal valid plugin manifest", () => {
  expect(PluginPackageSchema.safeParse(base).success).toBe(true);
});

test("rejects a name with illegal characters", () => {
  const result = PluginPackageSchema.safeParse({ ...base, name: "Bad Name!" });
  expect(result.success).toBe(false);
});

test("rejects a non-semver version", () => {
  expect(PluginPackageSchema.safeParse({ ...base, version: "latest" }).success).toBe(false);
});

test("requires the engines.brika field", () => {
  const result = PluginPackageSchema.safeParse({ ...base, engines: { node: ">=20" } });
  expect(result.success).toBe(false);
});

test("requires a non-empty main entrypoint", () => {
  expect(PluginPackageSchema.safeParse({ ...base, main: "" }).success).toBe(false);
});

test("normalises a human-readable resource byte string to an integer", () => {
  const result = PluginPackageSchema.safeParse({
    ...base,
    resources: { fs: { maxFileBytes: "2gb", quotas: { data: "500mb" } } },
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.resources?.fs?.maxFileBytes).toBe(2 * 1024 ** 3);
    expect(result.data.resources?.fs?.quotas?.data).toBe(500 * 1024 ** 2);
  }
});

test("validates a block category against the allowed set", () => {
  const ok = PluginPackageSchema.safeParse({
    ...base,
    blocks: [{ id: "send", category: "action" }],
  });
  expect(ok.success).toBe(true);
  const bad = PluginPackageSchema.safeParse({
    ...base,
    blocks: [{ id: "send", category: "nope" }],
  });
  expect(bad.success).toBe(false);
});
