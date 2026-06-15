import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CliError } from "./errors";

/**
 * CLI state lives in `~/.config/brika/config.json` (honoring `XDG_CONFIG_HOME`),
 * like a `~/.npmrc`. It holds the publish token issued by `brika login`, so the
 * file is written atomically and kept owner-only.
 */

export const DEFAULT_REGISTRY = "https://registry.brika.dev";

const ConfigSchema = z.object({
  registry: z.string().min(1).default(DEFAULT_REGISTRY),
  token: z.string().optional(),
  githubLogin: z.string().optional(),
});

export type CliConfig = z.infer<typeof ConfigSchema>;

const configDir = (): string =>
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "brika");
const configFile = (): string => join(configDir(), "config.json");

/** Effective registry URL: `BRIKA_REGISTRY` wins, then saved config. */
export function registryUrl(config: CliConfig): string {
  return process.env.BRIKA_REGISTRY ?? config.registry;
}

/** Effective publish token: `BRIKA_TOKEN` wins (handy in CI), then the login. */
export function authToken(config: CliConfig): string | undefined {
  return process.env.BRIKA_TOKEN ?? config.token;
}

export async function loadConfig(): Promise<CliConfig> {
  const handle = Bun.file(configFile());
  if (!(await handle.exists())) return ConfigSchema.parse({});

  let raw: unknown;
  try {
    raw = await handle.json();
  } catch {
    throw new CliError(`config at ${configFile()} is not valid JSON; fix or delete it`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new CliError(`config at ${configFile()} is invalid: ${issue?.message ?? "bad shape"}`);
  }
  return parsed.data;
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  // Write to a temp file then rename, so a crash never leaves a half-written
  // credential file. Create it owner-only from the start, and re-assert 0600.
  const target = configFile();
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, target);
  await chmod(target, 0o600);
}

/** Drop the token but keep the chosen registry. */
export async function clearToken(): Promise<void> {
  const current = await loadConfig();
  await saveConfig({ registry: current.registry });
}
