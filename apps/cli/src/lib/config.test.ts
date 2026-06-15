import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authToken, clearToken, loadConfig, registryUrl, saveConfig } from "./config";

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
  await saveConfig({ registry: "https://registry.brika.dev", token: "brika_x", githubLogin: "me" });
  const config = await loadConfig();
  expect(config.token).toBe("brika_x");
  expect(authToken(config)).toBe("brika_x");
});

test("environment overrides win over the file", async () => {
  await saveConfig({ registry: "https://file.test", token: "brika_file" });
  process.env.BRIKA_REGISTRY = "https://env.test";
  process.env.BRIKA_TOKEN = "brika_env";
  const config = await loadConfig();
  expect(registryUrl(config)).toBe("https://env.test");
  expect(authToken(config)).toBe("brika_env");
});

test("clearToken keeps the registry but drops the token", async () => {
  await saveConfig({ registry: "https://file.test", token: "brika_x" });
  await clearToken();
  const config = await loadConfig();
  expect(config.token).toBeUndefined();
  expect(config.registry).toBe("https://file.test");
});
