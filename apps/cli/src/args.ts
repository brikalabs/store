import { CliError, USAGE_EXIT } from "./errors";

/**
 * Per-command argument parsing. Each command parses its own slice of argv (the
 * tokens after the command name), so commands stay self-contained and can be
 * mounted into another CLI (the hub) without a shared global parser. Unknown
 * flags and extra positionals are rejected rather than silently ignored.
 */
export interface CommandArgs {
  /** The single optional positional (e.g. a directory). */
  readonly positional: string | undefined;
  /** Whether a known boolean flag was passed. */
  has(flag: string): boolean;
}

export function parseCommandArgs(
  argv: readonly string[],
  allowedFlags: readonly string[],
): CommandArgs {
  const flags = new Set<string>();
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("-")) {
      if (!allowedFlags.includes(arg)) {
        throw new CliError(`unknown option "${arg}" (run \`brika help\`)`, USAGE_EXIT);
      }
      flags.add(arg);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 1) {
    throw new CliError(`unexpected extra argument "${positionals[1]}"`, USAGE_EXIT);
  }
  return { positional: positionals[0], has: (flag) => flags.has(flag) };
}
