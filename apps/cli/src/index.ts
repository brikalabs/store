#!/usr/bin/env bun
import { RegistryPublishSchema } from "@brika/schema/store";
import { authToken, loadConfig, logout, registryUrl, saveConfig } from "./config";
import { type Packed, packDirectory } from "./pack";
import { pollDeviceToken, publishVersion, requestDeviceCode, revokeToken } from "./registry";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Show exactly what a publish would upload: digests, sizes, and the file list. */
function printSummary(packed: Packed): void {
  console.log(`\n${packed.name}@${packed.version}`);
  console.log(`  tarball    ${packed.filename}`);
  console.log(
    `  size       ${formatBytes(packed.size)} packed / ${formatBytes(packed.unpackedSize)} unpacked`,
  );
  console.log(`  integrity  ${packed.integrity}`);
  console.log(`  shasum     ${packed.shasum}`);
  console.log(`  files (${packed.files.length})`);
  for (const file of packed.files) {
    console.log(`    ${file.path}  (${formatBytes(file.size)})`);
  }
}

/** Validate a packed manifest against the published-plugin contract. */
function validate(packed: Packed): boolean {
  const check = RegistryPublishSchema.safeParse(packed.manifest);
  if (check.success) return true;
  console.error(`\n${packed.name} is not a publishable Brika plugin:`);
  for (const issue of check.error.issues) {
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    console.error(`  - ${where}${issue.message}`);
  }
  return false;
}

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

async function cmdPack(dir: string): Promise<number> {
  const packed = await packDirectory(dir);
  if (!validate(packed)) return 1;
  printSummary(packed);
  await Bun.write(packed.filename, packed.tarball);
  console.log(`\nWrote ${packed.filename}`);
  return 0;
}

async function cmdPublish(dir: string, dryRun: boolean): Promise<number> {
  const config = await loadConfig();
  const registry = registryUrl(config);
  const packed = await packDirectory(dir);
  if (!validate(packed)) return 1;
  printSummary(packed);

  if (dryRun) {
    console.log("\nDry run: validated and packed, not published.");
    return 0;
  }

  const token = authToken(config);
  if (token === undefined) {
    console.error("\nNot logged in. Run `brika login` (or set BRIKA_TOKEN).");
    return 1;
  }

  console.log(`\nPublishing to ${registry} ...`);
  const outcome = await publishVersion(registry, token, {
    name: packed.name,
    version: packed.version,
    manifest: packed.manifest,
    tarballBase64: Buffer.from(packed.tarball).toString("base64"),
  });
  if (!outcome.ok) {
    const code = outcome.code !== undefined ? ` ${outcome.code}` : "";
    console.error(`\nPublish rejected (${outcome.status}${code}): ${outcome.error}`);
    return 1;
  }
  // The registry recomputes integrity from the bytes it received; confirm it
  // matches what we packed, so a corrupted upload is never accepted silently.
  if (outcome.integrity !== packed.integrity) {
    console.error(
      `\nIntegrity mismatch: packed ${packed.integrity}, registry stored ${outcome.integrity}.`,
    );
    return 1;
  }
  console.log(`\n+ ${packed.name}@${packed.version}\n  integrity verified: ${outcome.integrity}`);
  return 0;
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

async function cmdLogout(): Promise<number> {
  const config = await loadConfig();
  const token = authToken(config);
  if (token !== undefined) {
    // Best-effort server-side revoke; clear the local token regardless of the result.
    await revokeToken(registryUrl(config), token).catch(() => {});
  }
  await logout();
  console.log(token !== undefined ? "Logged out (token revoked)." : "Logged out.");
  return 0;
}

function usage(): void {
  console.log(`brika - publish Brika plugins to the registry

Usage:
  brika login                Authorize this machine (GitHub device flow)
  brika pack [dir]           Pack the plugin and write/inspect the tarball
  brika publish [dir]        Pack, validate, and publish (default dir: .)
  brika publish --dry-run    Pack and validate without publishing
  brika whoami               Show the current login
  brika logout               Revoke the token and remove it locally

Env:
  BRIKA_REGISTRY   Registry URL (default https://registry.brika.dev)
  BRIKA_TOKEN      Publish token to use instead of the saved login (CI)`);
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const positional = rest.filter((arg) => !arg.startsWith("-"));
  const dryRun = rest.includes("--dry-run") || rest.includes("-n");
  switch (command) {
    case "login":
      return cmdLogin();
    case "pack":
      return cmdPack(positional[0] ?? process.cwd());
    case "publish":
      return cmdPublish(positional[0] ?? process.cwd(), dryRun);
    case "whoami":
      return cmdWhoami();
    case "logout":
      return cmdLogout();
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
