import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError } from "@brika/cli-kit";
import { z } from "zod";

/**
 * CLI state lives in `~/.config/brika/config.json` (honoring `XDG_CONFIG_HOME`),
 * like a `~/.npmrc`. It holds the publish token issued by `brika login`, so the
 * file is written atomically and kept owner-only.
 *
 * `BRIKA_REGISTRY` / `BRIKA_TOKEN` override the stored values when set (handy in
 * CI). `loadConfig()` folds them in, so commands just read `.registry` / `.token`
 * — the overrides are read-only and never written back to the file.
 */

export const DEFAULT_REGISTRY = "https://registry.brika.dev";

const RegistryUrl = z.url();

const ConfigSchema = z.object({
  registry: RegistryUrl.default(DEFAULT_REGISTRY),
  token: z.string().optional(),
  githubLogin: z.string().optional(),
});

export type CliConfig = z.infer<typeof ConfigSchema>;

const configDir = (): string =>
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "brika");
const configFile = (): string => join(configDir(), "config.json");

/** The config as commands see it: the saved file with `BRIKA_*` applied on top. */
export async function loadConfig(): Promise<CliConfig> {
  const stored = await readStored();
  const registry = process.env.BRIKA_REGISTRY;
  if (registry && !RegistryUrl.safeParse(registry).success) {
    throw new CliError(`BRIKA_REGISTRY is not a valid URL: ${registry}`);
  }
  return {
    ...stored,
    registry: registry || stored.registry,
    token: process.env.BRIKA_TOKEN || stored.token,
  };
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  // Write to a temp file then rename, so a crash never leaves a half-written
  // credential file. The temp is owner-only from the start; rename keeps its mode.
  const target = configFile();
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, target);
}

/** Drop the token but keep the saved registry, ignoring any env override. */
export async function clearToken(): Promise<void> {
  const stored = await readStored();
  await saveConfig({ registry: stored.registry });
}

/** Read and validate the raw config file, or defaults when it doesn't exist. */
async function readStored(): Promise<CliConfig> {
  const file = configFile();
  // Single read: a missing file (ENOENT) means "no config yet" -> defaults.
  // Anything else that fails to read or parse is a real, surfaced error.
  let raw: unknown;
  try {
    raw = await Bun.file(file).json();
  } catch (err) {
    if ((err as { code?: string }).code === "ENOENT") return ConfigSchema.parse({});
    throw new CliError(`config at ${file} is not valid JSON; fix or delete it`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new CliError(`config at ${file} is invalid: ${issue?.message ?? "bad shape"}`);
  }
  return parsed.data;
}
