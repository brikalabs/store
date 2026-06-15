#!/usr/bin/env bun
import { RegistryPublishSchema } from "@brika/schema/store";
import { authToken, loadConfig, logout, registryUrl, saveConfig } from "./config";
import { packDirectory } from "./pack";
import { pollDeviceToken, publishVersion, requestDeviceCode } from "./registry";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function cmdLogin(): Promise<number> {
  const config = await loadConfig();
  const registry = registryUrl(config);
  const device = await requestDeviceCode(registry);
  console.log(
    `\nTo authorize this machine, open:\n\n  ${device.verification_uri}\n\n` +
      `and enter the code:\n\n  ${device.user_code}\n\nWaiting for approval...`,
  );

  const deadline = Date.now() + device.expires_in * 1000;
  let interval = device.interval;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const poll = await pollDeviceToken(registry, device.device_code);
    if (poll.status === "ok") {
      await saveConfig({ registry, token: poll.token, githubLogin: poll.githubLogin });
      console.log(`\nLogged in as ${poll.githubLogin}.`);
      return 0;
    }
    if (poll.status === "slow_down") interval += 5;
    if (poll.status === "error") {
      console.error(`\nLogin failed: ${poll.error}`);
      return 1;
    }
  }
  console.error("\nLogin timed out. Run `brika login` again.");
  return 1;
}

async function cmdPublish(dir: string): Promise<number> {
  const config = await loadConfig();
  const registry = registryUrl(config);
  const token = authToken(config);
  if (token === undefined) {
    console.error("Not logged in. Run `brika login` (or set BRIKA_TOKEN).");
    return 1;
  }

  const packed = await packDirectory(dir);
  // Validate against the published-plugin contract before uploading, so manifest
  // problems are reported locally instead of as a 400 from the registry.
  const check = RegistryPublishSchema.safeParse(packed.manifest);
  if (!check.success) {
    console.error(`\n${packed.name} is not a publishable Brika plugin:`);
    for (const issue of check.error.issues) {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      console.error(`  - ${where}${issue.message}`);
    }
    return 1;
  }

  const sizeKb = (packed.tarball.byteLength / 1024).toFixed(1);
  console.log(`Publishing ${packed.name}@${packed.version} (${sizeKb} KiB) to ${registry} ...`);
  const outcome = await publishVersion(registry, token, {
    name: packed.name,
    version: packed.version,
    manifest: packed.manifest,
    tarballBase64: Buffer.from(packed.tarball).toString("base64"),
  });
  if (outcome.ok) {
    console.log(`\n+ ${packed.name}@${packed.version}\n  ${outcome.integrity}`);
    return 0;
  }
  const code = outcome.code !== undefined ? ` ${outcome.code}` : "";
  console.error(`\nPublish rejected (${outcome.status}${code}): ${outcome.error}`);
  return 1;
}

async function cmdWhoami(): Promise<number> {
  const config = await loadConfig();
  if (authToken(config) === undefined) {
    console.log("Not logged in.");
    return 0;
  }
  console.log(`${config.githubLogin ?? "logged in"} (${registryUrl(config)})`);
  return 0;
}

function usage(): void {
  console.log(`brika - publish Brika plugins to the registry

Usage:
  brika login            Authorize this machine (GitHub device flow)
  brika publish [dir]    Pack and publish the plugin in [dir] (default: .)
  brika whoami           Show the current login
  brika logout           Remove the saved token

Env:
  BRIKA_REGISTRY   Registry URL (default https://registry.brika.dev)
  BRIKA_TOKEN      Publish token to use instead of the saved login (CI)`);
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "login":
      return cmdLogin();
    case "publish":
      return cmdPublish(rest[0] ?? process.cwd());
    case "whoami":
      return cmdWhoami();
    case "logout":
      await logout();
      console.log("Logged out.");
      return 0;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      usage();
      return 0;
    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
