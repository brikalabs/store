import { type Cli, createCli } from "@brika/cli-kit";
import { registryCommands } from "./commands";

/**
 * Library entry for embedding. The standalone `brika` binary (src/index.ts)
 * calls `createRegistryCli().run()`; the hub merges the same commands with
 * `hub.addCommands(registryCommands)` (flat) or `hub.addCommands({ name:
 * "registry", description, commands: registryCommands })` (namespaced as
 * `brika registry publish`).
 */
export { registryCommands } from "./commands";

export function createRegistryCli(): Cli {
  return createCli({
    name: "brika",
    defaultCommand: "help",
    commands: registryCommands,
  }).addHelp();
}
