import { CliError, defineCommand } from "@brika/cli-kit";
import { requireAuth } from "../lib/config";
import { RegistryClient } from "../lib/registry";
import { withSpinner } from "../lib/spinner";

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

    const { token, registry } = await requireAuth();
    const client = new RegistryClient(registry);

    if (values.undo) {
      return withSpinner("Restoring", async () => {
        await client.restorePackage(token, pkg);
        return `Restored ${pkg}`;
      });
    }

    if (reason === undefined || reason.trim() === "") {
      throw new CliError("a takedown needs a reason: brika takedown <pkg> <reason>");
    }
    await withSpinner("Taking down", async () => {
      await client.takedownPackage(token, pkg, reason);
      return `Took down ${pkg}`;
    });
  },
});
