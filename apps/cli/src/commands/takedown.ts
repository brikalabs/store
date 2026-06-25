import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const takedown = defineCommand({
  name: "takedown",
  description: "Operator: withdraw a whole plugin from the registry (or restore it)",
  details:
    "An operator-only moderation action: takes down every version of a plugin, current AND future, hiding it from resolution and search (stronger than yank, which is per-version and keeps the bytes). Needs a registry-operator token. Reversible with --undo.",
  args: {
    pkg: { description: "Package name, e.g. @brika/plugin-x" },
    reason: { description: "Why it is being taken down (required unless --undo)" },
  },
  options: {
    undo: {
      type: "boolean",
      default: false,
      description: "Restore a previously taken-down plugin",
    },
  },
  examples: [
    'brika takedown @brika/plugin-x "violates the content policy"',
    "brika takedown @brika/plugin-x --undo",
  ],
  async handler({ args, values }) {
    const { pkg, reason } = args;
    if (pkg === undefined) {
      throw new CliError("usage: brika takedown <pkg> <reason>  (or --undo to restore)");
    }

    const { token, registry } = await loadConfig();
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }

    const client = new RegistryClient(registry);
    const spin = p.spinner();

    if (values.undo) {
      spin.start("Restoring");
      await client.restorePackage(token, pkg).catch((error: unknown) => {
        spin.stop("Failed");
        throw error;
      });
      spin.stop(`Restored ${pkg}`);
      return;
    }

    if (reason === undefined || reason.trim() === "") {
      throw new CliError("a takedown needs a reason: brika takedown <pkg> <reason>");
    }
    spin.start("Taking down");
    await client.takedownPackage(token, pkg, reason).catch((error: unknown) => {
      spin.stop("Failed");
      throw error;
    });
    spin.stop(`Took down ${pkg}`);
  },
});
