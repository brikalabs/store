import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const deprecate = defineCommand({
  name: "deprecate",
  description: "Attach a deprecation notice to a published version (or clear it)",
  args: {
    pkg: { description: "Package name, e.g. @brika/plugin-x" },
    version: { description: "Exact version, e.g. 1.2.3" },
    message: { description: "Deprecation message shown to installers" },
  },
  options: {
    undo: { type: "boolean", default: false, description: "Clear an existing deprecation notice" },
  },
  examples: [
    'brika deprecate @brika/plugin-x 1.2.3 "Use 2.x; this line is unmaintained"',
    "brika deprecate @brika/plugin-x 1.2.3 --undo",
  ],
  async handler({ args, values }) {
    const { pkg, version, message } = args;
    if (pkg === undefined || version === undefined) {
      throw new CliError("usage: brika deprecate <pkg> <version> <message>");
    }
    if (!values.undo && (message === undefined || message.trim().length === 0)) {
      throw new CliError("a deprecation message is required (or pass --undo to clear)");
    }

    const { token, registry } = await loadConfig();
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }

    const next = values.undo ? null : (message ?? null);
    const spin = p.spinner();
    spin.start(values.undo ? "Clearing deprecation" : "Deprecating");
    await new RegistryClient(registry)
      .deprecate(token, pkg, version, next)
      .catch((error: unknown) => {
        spin.stop("Failed");
        throw error;
      });
    spin.stop(
      values.undo ? `Cleared deprecation on ${pkg}@${version}` : `Deprecated ${pkg}@${version}`,
    );
  },
});
