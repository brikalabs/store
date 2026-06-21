import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";

export const whoami = defineCommand({
  name: "whoami",
  description: "Show the signed-in account",
  async handler() {
    const config = await loadConfig();
    if (config.token === undefined) {
      p.log.info("Not logged in.");
      return;
    }
    // Prefer the human display name; fall back to the account id, then a neutral label.
    const account = config.displayName ?? config.userId ?? "logged in";
    p.log.info(`${account} (${config.registry})`);
  },
});
