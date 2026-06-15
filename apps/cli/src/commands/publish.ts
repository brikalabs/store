import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { authToken, loadConfig, registryUrl } from "../lib/config";
import { RegistryClient } from "../lib/registry";
import { prepare } from "./prepare";

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
    const packed = await prepare(args.dir);
    if (values.dryRun) {
      p.log.info("Dry run: validated and packed, not published.");
      return;
    }

    const config = await loadConfig();
    const token = authToken(config);
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }
    const registry = registryUrl(config);
    const spin = p.spinner();
    spin.start(`Publishing to ${registry}`);
    const { integrity } = await new RegistryClient(registry)
      .publish(token, {
        name: packed.name,
        version: packed.version,
        manifest: packed.manifest,
        tarball: Buffer.from(packed.tarball).toString("base64"),
      })
      .catch((error: unknown) => {
        spin.stop("Publish rejected");
        throw error;
      });

    // The registry recomputes integrity from the bytes it received; confirm it
    // matches what we packed so a corrupted upload is never accepted silently.
    if (integrity !== packed.integrity) {
      spin.stop("Integrity mismatch");
      throw new CliError(
        `integrity mismatch: packed ${packed.integrity}, registry stored ${integrity}`,
      );
    }
    spin.stop(`Published ${packed.name}@${packed.version}`);
    p.log.success(`integrity verified: ${integrity}`);
  },
});
