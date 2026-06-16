import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const yank = defineCommand({
  name: "yank",
  description: "Hide a published version from new installs (or restore it)",
  details:
    "Yanking removes a version from the packument so new installs skip it, but keeps the bytes so existing lockfiles that pin its integrity still resolve. Reversible with --undo.",
  args: {
    pkg: { description: "Package name, e.g. @brika/plugin-x" },
    version: { description: "Exact version, e.g. 1.2.3" },
  },
  options: {
    undo: { type: "boolean", default: false, description: "Restore a previously yanked version" },
  },
  examples: ["brika yank @brika/plugin-x 1.2.3", "brika yank @brika/plugin-x 1.2.3 --undo"],
  async handler({ args, values }) {
    const { pkg, version } = args;
    if (pkg === undefined || version === undefined) {
      throw new CliError("usage: brika yank <pkg> <version>");
    }

    const { token, registry } = await loadConfig();
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }

    const yanked = !values.undo;
    const spin = p.spinner();
    spin.start(yanked ? "Yanking" : "Restoring");
    await new RegistryClient(registry).yank(token, pkg, version, yanked).catch((error: unknown) => {
      spin.stop("Failed");
      throw error;
    });
    spin.stop(yanked ? `Yanked ${pkg}@${version}` : `Restored ${pkg}@${version}`);
  },
});
