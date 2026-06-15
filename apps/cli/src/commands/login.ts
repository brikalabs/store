import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { loadConfig, registryUrl, saveConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const login = defineCommand({
  name: "login",
  description: "Authorize this machine (GitHub device flow)",
  examples: ["brika login"],
  async handler() {
    const config = await loadConfig();
    const registry = registryUrl(config);
    const client = new RegistryClient(registry);

    p.intro("brika login");
    const device = await client.requestDeviceCode();
    p.note(`${device.verification_uri}\n\nCode:  ${device.user_code}`, "Authorize this device");

    const spin = p.spinner();
    spin.start("Waiting for approval");
    const deadline = Date.now() + device.expires_in * 1000;
    let interval = device.interval;
    while (Date.now() < deadline) {
      await Bun.sleep(interval * 1000);
      const poll = await client.pollDeviceToken(device.device_code);
      if (poll.status === "ok") {
        await saveConfig({ registry, token: poll.token, githubLogin: poll.githubLogin });
        spin.stop(`Logged in as ${poll.githubLogin}`);
        p.outro("Done.");
        return;
      }
      if (poll.status === "slow_down") interval += 5;
      if (poll.status === "error") {
        spin.stop("Login failed");
        throw new CliError(poll.error);
      }
    }
    spin.stop("Login timed out");
    throw new CliError("login timed out - run `brika login` again");
  },
});
