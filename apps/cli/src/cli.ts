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
  // Help is built-in and the default command, so `brika` shows help and
  // `brika <command>` runs it. No `defaultCommand` or `addHelp()` needed.
  return createCli({ name: "brika", commands: registryCommands });
}
