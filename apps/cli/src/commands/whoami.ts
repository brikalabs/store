import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig } from "../lib/config";

export const whoami = defineCommand({
  name: "whoami",
  description: "Show the current login",
  async handler() {
    const config = await loadConfig();
    if (config.token === undefined) {
      p.log.info("Not logged in.");
      return;
    }
    p.log.info(`${config.githubLogin ?? "logged in"} (${config.registry})`);
  },
});
