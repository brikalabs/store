import * as p from "@brika/cli-kit/prompts";

/** Run `work` under a spinner, stopping with its returned message on success or "Failed" on throw (re-thrown). */
export async function withSpinner(start: string, work: () => Promise<string>): Promise<void> {
  const spin = p.spinner();
  spin.start(start);
  try {
    spin.stop(await work());
  } catch (error) {
    spin.stop("Failed");
    throw error;
  }
}
