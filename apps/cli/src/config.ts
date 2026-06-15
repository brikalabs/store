import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * CLI state lives in `~/.brika/config.json` (like `~/.npmrc`). It holds the
 * publish token issued by `brika login`, so the file is kept owner-only.
 */

export const DEFAULT_REGISTRY = "https://registry.brika.dev";

export interface CliConfig {
  readonly registry: string;
  readonly token?: string;
  readonly githubLogin?: string;
}

// Respect XDG on Linux (~/.config/brika), falling back to ~/.config elsewhere.
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
  if (!(await handle.exists())) return { registry: DEFAULT_REGISTRY };
  const raw = (await handle.json()) as Partial<CliConfig>;
  return {
    registry: raw.registry ?? DEFAULT_REGISTRY,
    token: raw.token,
    githubLogin: raw.githubLogin,
  };
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await Bun.write(configFile(), `${JSON.stringify(config, null, 2)}\n`);
  await chmod(configFile(), 0o600);
}

/** Drop the token but keep the chosen registry. */
export async function logout(): Promise<void> {
  const current = await loadConfig();
  await saveConfig({ registry: current.registry });
}
