import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearToken, loadConfig, requireAuth, saveConfig } from "./config";

const ENV_KEYS = ["XDG_CONFIG_HOME", "BRIKA_REGISTRY", "BRIKA_TOKEN"];
let dir: string;
let saved: Record<string, string | undefined>;

beforeEach(async () => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  dir = await mkdtemp(join(tmpdir(), "brika-cfg-"));
  process.env.XDG_CONFIG_HOME = dir;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("defaults when no config file exists", async () => {
  const config = await loadConfig();
  expect(config.registry).toBe("https://registry.brika.dev");
  expect(config.token).toBeUndefined();
});

test("round-trips a saved token", async () => {
  await saveConfig({ registry: "https://registry.brika.dev", token: "brika_x", userId: "usr_1" });
  const config = await loadConfig();
  expect(config.token).toBe("brika_x");
});

test("environment overrides win over the file", async () => {
  await saveConfig({ registry: "https://file.test", token: "brika_file" });
  process.env.BRIKA_REGISTRY = "https://env.test";
  process.env.BRIKA_TOKEN = "brika_env";
  const config = await loadConfig();
  expect(config.registry).toBe("https://env.test");
  expect(config.token).toBe("brika_env");
});

test("rejects a malformed BRIKA_REGISTRY override", async () => {
  process.env.BRIKA_REGISTRY = "not-a-url";
  await expect(loadConfig()).rejects.toThrow(/BRIKA_REGISTRY is not a valid URL/);
});

test("clearToken keeps the registry but drops the token", async () => {
  await saveConfig({ registry: "https://file.test", token: "brika_x" });
  await clearToken();
  const config = await loadConfig();
  expect(config.token).toBeUndefined();
  expect(config.registry).toBe("https://file.test");
});

test("requireAuth returns the token when set, else fails with a login hint", async () => {
  await expect(requireAuth()).rejects.toThrow(/not logged in/);
  await saveConfig({ registry: "https://file.test", token: "brika_x" });
  expect((await requireAuth()).token).toBe("brika_x");
});
