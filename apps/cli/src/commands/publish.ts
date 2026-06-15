import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { authToken, loadConfig, registryUrl } from "../lib/config";
import { RegistryClient } from "../lib/registry";
import { packDirectory } from "../lib/tarball";
import { printSummary } from "./summary";
import { assertPublishable } from "./validate";

export const publish = defineCommand({
  name: "publish",
  description: "Pack, validate, and publish a plugin",
  args: {
    dir: { description: "Plugin directory (defaults to the current directory)", default: "." },
  },
  options: {
    "dry-run": {
      type: "boolean",
      short: "n",
      default: false,
      description: "Validate and pack without publishing",
    },
  },
  examples: ["brika publish ./my-plugin", "brika publish --dry-run"],
  async handler({ values, args }) {
    const config = await loadConfig();
    const packed = await packDirectory(args.dir);
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
