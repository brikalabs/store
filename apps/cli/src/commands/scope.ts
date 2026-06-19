import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";
import { RegistryClient, type ScopeRole } from "../lib/registry";

/** Parse a member reference: `provider:id` (e.g. `github:alice`), or a bare id (github). */
function parseMember(ref: string): { provider: string; id: string } {
  const colon = ref.indexOf(":");
  return colon === -1
    ? { provider: "github", id: ref }
    : { provider: ref.slice(0, colon), id: ref.slice(colon + 1) };
}

/** Run `work` under a spinner, stopping with `done` (its return) or "Failed" on throw. */
async function withSpinner(start: string, work: () => Promise<string>): Promise<void> {
  const spin = p.spinner();
  spin.start(start);
  try {
    spin.stop(await work());
  } catch (error) {
    spin.stop("Failed");
    throw error;
  }
}

const USAGE = "usage: brika scope <create|members|add|remove> <@scope> [provider:id]";

async function runMembers(client: RegistryClient, token: string, scope: string): Promise<void> {
  const members = await client.listScopeMembers(token, scope);
  for (const m of members) p.log.info(`  ${m.provider}:${m.id} (${m.role})`);
  p.log.info(`${members.length} member(s) of ${scope}`);
}

async function runAdd(
  client: RegistryClient,
  token: string,
  scope: string,
  member: string | undefined,
  role: string,
): Promise<void> {
  if (member === undefined) throw new CliError("usage: brika scope add <@scope> <provider:id>");
  if (role !== "admin" && role !== "member")
    throw new CliError("--role must be 'admin' or 'member'");
  await withSpinner(`Adding ${member} to ${scope}`, async () => {
    await client.setScopeMember(token, scope, parseMember(member), role as ScopeRole);
    return `Set ${member} as ${role} on ${scope}`;
  });
}

async function runRemove(
  client: RegistryClient,
  token: string,
  scope: string,
  member: string | undefined,
): Promise<void> {
  if (member === undefined) throw new CliError("usage: brika scope remove <@scope> <provider:id>");
  await withSpinner(`Removing ${member} from ${scope}`, async () => {
    await client.removeScopeMember(token, scope, parseMember(member));
    return `Removed ${member} from ${scope}`;
  });
}

export const scope = defineCommand({
  name: "scope",
  description: "Manage publishing scopes and their members",
  details:
    "A scope must exist before you can publish under it, and is governed by its members. The creator is the first admin; a scope always keeps at least one admin. Names are lowercase, 2-20 characters, letters/digits/hyphens, not starting with a hyphen.",
  args: {
    action: { description: "create | members | add | remove" },
    scope: { description: "Scope name, e.g. @brika" },
    member: { description: "For add/remove: provider:id (e.g. github:alice) or a bare id" },
  },
  options: {
    role: { type: "string", default: "member", description: "For add: admin | member" },
  },
  examples: [
    "brika scope create @brika",
    "brika scope members @brika",
    "brika scope add @brika github:alice --role admin",
    "brika scope remove @brika github:alice",
  ],
  async handler({ args, values }) {
    const { action, scope: name, member } = args;
    if (name === undefined || name.length === 0) throw new CliError(USAGE);

    const { token, registry } = await loadConfig();
    if (token === undefined) {
      throw new CliError("not logged in - run `brika login` (or set BRIKA_TOKEN)");
    }
    const client = new RegistryClient(registry);

    switch (action) {
      case "create":
        return withSpinner(`Creating ${name}`, async () => {
          const { created } = await client.createScope(token, name);
          return created ? `Created scope ${name}` : `You already own scope ${name}`;
        });
      case "members":
        return runMembers(client, token, name);
      case "add":
        return runAdd(client, token, name, member, values.role);
      case "remove":
        return runRemove(client, token, name, member);
      default:
        throw new CliError(USAGE);
    }
  },
});
