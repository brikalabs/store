import { CliError, type Command, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { RegistryPublishSchema } from "@brika/schema/store";
import { authToken, clearToken, loadConfig, registryUrl, saveConfig } from "./config";
import { printSummary } from "./output";
import { type Packed, packDirectory } from "./pack";
import { RegistryClient } from "./registry";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Reject anything that is not a valid, listable Brika plugin before uploading. */
function assertPublishable(packed: Packed): void {
  const result = RegistryPublishSchema.safeParse(packed.manifest);
  if (result.success) return;
  const detail = result.error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `  - ${where}${issue.message}`;
    })
    .join("\n");
  throw new CliError(`${packed.name} is not a publishable Brika plugin:\n${detail}`);
}

const login = defineCommand({
  name: "login",
  description: "Authorize this machine (GitHub device flow)",
  examples: ["brika login"],
  async handler() {
    const config = await loadConfig();
    const registry = registryUrl(config);
    const client = new RegistryClient(registry);

    p.intro("brika login");
    const device = await client.requestDeviceCode();
    p.note(`${device.verification_uri}\n\nCode:  ${device.user_code}`, "Authorize this device");

    const spin = p.spinner();
    spin.start("Waiting for approval");
    const deadline = Date.now() + device.expires_in * 1000;
    let interval = device.interval;
    while (Date.now() < deadline) {
      await sleep(interval * 1000);
      const poll = await client.pollDeviceToken(device.device_code);
      if (poll.status === "ok") {
        await saveConfig({ registry, token: poll.token, githubLogin: poll.githubLogin });
        spin.stop(`Logged in as ${poll.githubLogin}`);
        p.outro("Done.");
        return;
      }
      if (poll.status === "slow_down") interval += 5;
      if (poll.status === "error") {
        spin.stop("Login failed");
        throw new CliError(poll.error);
      }
    }
    spin.stop("Login timed out");
    throw new CliError("login timed out - run `brika login` again");
  },
});

const pack = defineCommand({
  name: "pack",
  description: "Pack the plugin and write/inspect the tarball",
  examples: ["brika pack ./my-plugin"],
  async handler({ positionals }) {
    const packed = await packDirectory(positionals[0] ?? process.cwd());
    assertPublishable(packed);
    printSummary(packed);
    await Bun.write(packed.filename, packed.tarball);
    p.log.success(`Wrote ${packed.filename}`);
  },
});

const publish = defineCommand({
  name: "publish",
  description: "Pack, validate, and publish a plugin",
  options: {
    "dry-run": {
      type: "boolean",
      short: "n",
      default: false,
      description: "Validate and pack without publishing",
    },
  },
  examples: ["brika publish ./my-plugin", "brika publish --dry-run"],
  async handler({ values, positionals }) {
    const config = await loadConfig();
    const packed = await packDirectory(positionals[0] ?? process.cwd());
    assertPublishable(packed);
    printSummary(packed);

    if (values.dryRun) {
      p.log.info("Dry run: validated and packed, not published.");
      return;
    }

    const token = authToken(config);
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }
    const registry = registryUrl(config);
    const spin = p.spinner();
    spin.start(`Publishing to ${registry}`);
    const result = await new RegistryClient(registry).publish(token, {
      name: packed.name,
      version: packed.version,
      manifest: packed.manifest,
      tarballBase64: Buffer.from(packed.tarball).toString("base64"),
    });
    if (!result.ok) {
      spin.stop("Publish rejected");
      const code = result.code !== undefined ? ` ${result.code}` : "";
      throw new CliError(`publish rejected (${result.status}${code}): ${result.error}`);
    }
    // The registry recomputes integrity from the bytes it received; confirm it
    // matches what we packed so a corrupted upload is never accepted silently.
    if (result.integrity !== packed.integrity) {
      spin.stop("Integrity mismatch");
      throw new CliError(
        `integrity mismatch: packed ${packed.integrity}, registry stored ${result.integrity}`,
      );
    }
    spin.stop(`Published ${packed.name}@${packed.version}`);
    p.log.success(`integrity verified: ${result.integrity}`);
  },
});

const whoami = defineCommand({
  name: "whoami",
  description: "Show the current login",
  async handler() {
    const config = await loadConfig();
    if (authToken(config) === undefined) {
      p.log.info("Not logged in.");
      return;
    }
    p.log.info(`${config.githubLogin ?? "logged in"} (${registryUrl(config)})`);
  },
});

const logout = defineCommand({
  name: "logout",
  description: "Revoke the token and remove it locally",
  async handler() {
    const config = await loadConfig();
    const token = authToken(config);
    if (token !== undefined) {
      await new RegistryClient(registryUrl(config)).revokeToken(token);
    }
    await clearToken();
    p.log.success(token !== undefined ? "Logged out (token revoked)." : "Logged out.");
  },
});

/** The registry/publish command group. Exported so the hub CLI can mount it. */
export const registryCommands: readonly Command[] = [login, pack, publish, whoami, logout];
