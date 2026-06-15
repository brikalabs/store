/**
 * Library entry for embedding. The standalone `brika` binary lives in
 * `src/index.ts`; the hub CLI imports `registryCommands` (and `runCli` /
 * `CommandSpec` / `CliError`) to merge these commands into its own CLI, either
 * flattened or mounted under a namespace such as `brika registry ...`.
 */
export { type CommandSpec, runCli } from "./command";
export { registryCommands } from "./commands";
export { CliError } from "./errors";
