import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { authToken, loadConfig, registryUrl } from "../lib/config";

export const whoami = defineCommand({
  name: "whoami",
  description: "Show the current login",
  async handler() {
    const config = await loadConfig();
    if (authToken(config) === undefined) {
      p.log.info("Not logged in.");
      return;
    }
    p.log.info(`${config.githubLogin ?? "logged in"} (${registryUrl(config)})`);
  },
});
