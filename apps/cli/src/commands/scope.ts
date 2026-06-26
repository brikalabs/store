import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { requireAuth } from "../lib/config";
import { RegistryClient } from "../lib/registry";
import { withSpinner } from "../lib/spinner";

const USAGE = "usage: brika scope <create|members|add|remove> <@scope> [account-id]";

async function runMembers(client: RegistryClient, token: string, scope: string): Promise<void> {
  const members = await client.listScopeMembers(token, scope);
  for (const m of members) p.log.info(`  ${m.userId} (${m.role})`);
  p.log.info(`${members.length} member(s) of ${scope}`);
}

async function runAdd(
  client: RegistryClient,
  token: string,
  scope: string,
  member: string | undefined,
  role: string,
): Promise<void> {
  if (member === undefined) throw new CliError("usage: brika scope add <@scope> <account-id>");
  if (role !== "admin" && role !== "member") {
    throw new CliError("--role must be 'admin' or 'member'");
  }
  // `role` is narrowed to ScopeRole by the guard above - no cast needed.
  await withSpinner(`Adding ${member} to ${scope}`, async () => {
    await client.setScopeMember(token, scope, member, role);
    return `Set ${member} as ${role} on ${scope}`;
  });
}

async function runRemove(
  client: RegistryClient,
  token: string,
  scope: string,
  member: string | undefined,
): Promise<void> {
  if (member === undefined) throw new CliError("usage: brika scope remove <@scope> <account-id>");
  await withSpinner(`Removing ${member} from ${scope}`, async () => {
    await client.removeScopeMember(token, scope, member);
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
    member: { description: "For add/remove: a Brika account id" },
  },
  options: {
    role: { type: "string", default: "member", description: "For add: admin | member" },
  },
  examples: [
    "brika scope create @brika",
    "brika scope members @brika",
    "brika scope add @brika usr_abc123 --role admin",
    "brika scope remove @brika usr_abc123",
  ],
  async handler({ args, values }) {
    const { action, scope: name, member } = args;
    if (name === undefined || name.length === 0) throw new CliError(USAGE);

    const { token, registry } = await requireAuth();
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
