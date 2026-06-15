#!/usr/bin/env bun
import { runCli } from "./command";
import { registryCommands } from "./commands";
import { CliError } from "./errors";

/**
 * Standalone entrypoint. The only place that owns the process lifecycle: it
 * routes argv through the shared command group and maps the outcome to an exit
 * code. Expected failures (CliError) print a clean message; anything else is a
 * bug and prints its stack.
 */
runCli(registryCommands, process.argv.slice(2))
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    if (error instanceof CliError) {
      console.error(error.message);
      process.exit(error.exitCode);
    }
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
