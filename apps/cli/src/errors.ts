/**
 * An expected, user-facing failure: bad input, auth, network, or a rejected
 * publish. The top-level handler prints `message` (no stack) and exits with
 * `exitCode`. Anything that is *not* a CliError is treated as a bug and printed
 * with its stack so it can be reported.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

/** Exit code for usage mistakes (unknown command/flag), by convention. */
export const USAGE_EXIT = 2;
