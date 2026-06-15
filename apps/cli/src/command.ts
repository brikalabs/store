import { CliError, USAGE_EXIT } from "./errors";
import { printHelp } from "./output";

/**
 * A single CLI command, decoupled from argv parsing and the process lifecycle.
 * `run` receives the tokens *after* the command name, does its own parsing, and
 * throws `CliError` on failure (it never calls `process.exit`). This is the unit
 * both the standalone `brika` binary and the hub CLI consume, so the registry
 * commands can run on their own or be merged into the hub.
 */
export interface CommandSpec {
  readonly name: string;
  readonly summary: string;
  /** Argument hint shown in help, e.g. "[dir]". */
  readonly args?: string;
  run(argv: readonly string[]): Promise<void>;
}

/**
 * Route argv to a command and run it. The standalone entrypoint uses this; a
 * host CLI can call it directly, or instead adapt each {@link CommandSpec} into
 * its own framework (e.g. mount them under a `registry` namespace).
 */
export async function runCli(
  commands: readonly CommandSpec[],
  argv: readonly string[],
): Promise<void> {
  const [name, ...rest] = argv;
  if (name === undefined || name === "help" || name === "-h" || name === "--help") {
    printHelp(commands);
    return;
  }
  if (rest.includes("-h") || rest.includes("--help")) {
    printHelp(commands);
    return;
  }
  const command = commands.find((spec) => spec.name === name);
  if (command === undefined) {
    throw new CliError(`unknown command "${name}" (run \`brika help\`)`, USAGE_EXIT);
  }
  await command.run(rest);
}
