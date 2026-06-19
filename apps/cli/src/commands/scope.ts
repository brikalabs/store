import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const scope = defineCommand({
  name: "scope",
  description: "Manage publishing scopes (create/claim a scope you can publish under)",
  details:
    "A scope must exist before you can publish under it; whoever creates it owns it. Names are lowercase, 2-20 characters, letters/digits/hyphens, not starting with a hyphen.",
  args: {
    action: { description: "Action to perform: create" },
    scope: { description: "Scope name, e.g. @brika" },
  },
  examples: ["brika scope create @brika"],
  async handler({ args }) {
    const { action, scope: name } = args;
    if (action !== "create") {
      throw new CliError("usage: brika scope create <@scope>");
    }
    if (name === undefined || name.length === 0) {
      throw new CliError("usage: brika scope create <@scope>");
    }

    const { token, registry } = await loadConfig();
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }

    const spin = p.spinner();
    spin.start(`Creating ${name}`);
    const claim = await new RegistryClient(registry)
      .createScope(token, name)
      .catch((error: unknown) => {
        spin.stop("Failed");
        throw error;
      });
    spin.stop(claim.created ? `Created scope ${name}` : `You already own scope ${name}`);
  },
});
