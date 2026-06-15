import { RegistryPublishSchema } from "@brika/schema/store";
import { parseCommandArgs } from "./args";
import type { CommandSpec } from "./command";
import { authToken, clearToken, loadConfig, registryUrl, saveConfig } from "./config";
import { CliError } from "./errors";
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

const login: CommandSpec = {
  name: "login",
  summary: "Authorize this machine (GitHub device flow)",
  async run(argv) {
    parseCommandArgs(argv, []);
    const config = await loadConfig();
    const registry = registryUrl(config);
    const client = new RegistryClient(registry);
    const device = await client.requestDeviceCode();
    console.log(
      `\nTo authorize this machine, open:\n\n  ${device.verification_uri}\n\n` +
        `and enter the code:\n\n  ${device.user_code}\n\nWaiting for approval...`,
    );

    const deadline = Date.now() + device.expires_in * 1000;
    let interval = device.interval;
    while (Date.now() < deadline) {
      await sleep(interval * 1000);
      const poll = await client.pollDeviceToken(device.device_code);
      if (poll.status === "ok") {
        await saveConfig({ registry, token: poll.token, githubLogin: poll.githubLogin });
        console.log(`\nLogged in as ${poll.githubLogin}.`);
        return;
      }
      if (poll.status === "slow_down") interval += 5;
      if (poll.status === "error") throw new CliError(`login failed: ${poll.error}`);
    }
    throw new CliError("login timed out - run `brika login` again");
  },
};

const pack: CommandSpec = {
  name: "pack",
  summary: "Pack the plugin and write/inspect the tarball",
  args: "[dir]",
  async run(argv) {
    const args = parseCommandArgs(argv, []);
    const packed = await packDirectory(args.positional ?? process.cwd());
    assertPublishable(packed);
    printSummary(packed);
    await Bun.write(packed.filename, packed.tarball);
    console.log(`\nWrote ${packed.filename}`);
  },
};

const publish: CommandSpec = {
  name: "publish",
  summary: "Pack, validate, and publish (--dry-run to verify only)",
  args: "[dir]",
  async run(argv) {
    const args = parseCommandArgs(argv, ["--dry-run", "-n"]);
    const dryRun = args.has("--dry-run") || args.has("-n");
    const config = await loadConfig();
    const packed = await packDirectory(args.positional ?? process.cwd());
    assertPublishable(packed);
    printSummary(packed);

    if (dryRun) {
      console.log("\nDry run: validated and packed, not published.");
      return;
    }

    const token = authToken(config);
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }
    const registry = registryUrl(config);
    console.log(`\nPublishing to ${registry} ...`);
    const result = await new RegistryClient(registry).publish(token, {
      name: packed.name,
      version: packed.version,
      manifest: packed.manifest,
      tarballBase64: Buffer.from(packed.tarball).toString("base64"),
    });
    if (!result.ok) {
      const code = result.code !== undefined ? ` ${result.code}` : "";
      throw new CliError(`publish rejected (${result.status}${code}): ${result.error}`);
    }
    // The registry recomputes integrity from the bytes it received; confirm it
    // matches what we packed so a corrupted upload is never accepted silently.
    if (result.integrity !== packed.integrity) {
      throw new CliError(
        `integrity mismatch: packed ${packed.integrity}, registry stored ${result.integrity}`,
      );
    }
    console.log(`\n+ ${packed.name}@${packed.version}\n  integrity verified: ${result.integrity}`);
  },
};

const whoami: CommandSpec = {
  name: "whoami",
  summary: "Show the current login",
  async run(argv) {
    parseCommandArgs(argv, []);
    const config = await loadConfig();
    if (authToken(config) === undefined) {
      console.log("Not logged in.");
      return;
    }
    console.log(`${config.githubLogin ?? "logged in"} (${registryUrl(config)})`);
  },
};

const logout: CommandSpec = {
  name: "logout",
  summary: "Revoke the token and remove it locally",
  async run(argv) {
    parseCommandArgs(argv, []);
    const config = await loadConfig();
    const token = authToken(config);
    if (token !== undefined) {
      await new RegistryClient(registryUrl(config)).revokeToken(token);
    }
    await clearToken();
    console.log(token !== undefined ? "Logged out (token revoked)." : "Logged out.");
  },
};

/** The registry/publish command group. Exported so the hub CLI can mount it. */
export const registryCommands: readonly CommandSpec[] = [login, pack, publish, whoami, logout];
