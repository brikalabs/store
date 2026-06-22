/**
 * Brika prompts: a thin pass-through over @clack/prompts plus brika-specific helpers. Keep it thin:
 * re-export verbatim, and add a helper only when it captures behaviour every caller should share.
 *
 *   import * as p from "@brika/cli-kit/prompts";
 *   await p.confirmOrAbort({ message: "Continue?" });
 */

import { cancel, confirm, isCancel } from "@clack/prompts";

export type {
  ConfirmOptions,
  MultiSelectOptions,
  NoteOptions,
  Option,
  SelectOptions,
  SpinnerResult,
  TextOptions,
} from "@clack/prompts";
export {
  cancel,
  confirm,
  group,
  intro,
  isCancel,
  isCI,
  isTTY,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";

/** Options for {@link confirmOrAbort}. */
export interface ConfirmOrAbortOptions {
  /** Question shown to the user. */
  message: string;
  /** Default focus when the prompt opens. Defaults to `true`. */
  initialValue?: boolean;
  /** Banner printed when the user cancels or declines. Defaults to "Aborted." */
  abortMessage?: string;
  /** Exit code on abort. Defaults to `0` (interactive cancellation isn't an error); pass `1` to fail. */
  exitCode?: number;
}

/**
 * Ask a yes/no question, or terminate the process cleanly. On Ctrl-C or "no",
 * prints a styled abort line via `cancel()` and calls `process.exit(exitCode)`.
 */
export async function confirmOrAbort(options: ConfirmOrAbortOptions): Promise<void> {
  const ok = await confirm({
    message: options.message,
    initialValue: options.initialValue ?? true,
  });
  if (isCancel(ok) || !ok) {
    cancel(options.abortMessage ?? "Aborted.");
    process.exit(options.exitCode ?? 0);
  }
}
