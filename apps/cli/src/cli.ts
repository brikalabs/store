import { type Cli, createCli } from "@brika/cli-kit";
import { registryCommands } from "./commands";

/**
 * Library entry for embedding. The standalone `brika` binary (src/index.ts)
 * calls `createRegistryCli().run()`; the hub CLI mounts the same commands with
 * `createRegistryCli().toCommand("registry", "...")` so they run as
 * `brika registry publish`, or imports `registryCommands` to add them directly.
 */
export { registryCommands } from "./commands";

export function createRegistryCli(): Cli {
  return createCli({ name: "brika", defaultCommand: "help", commands: registryCommands }).addHelp();
}
