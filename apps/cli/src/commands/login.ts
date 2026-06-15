import { defineCommand } from "@brika/cli-kit";
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
    const { token, githubLogin } = await client.waitForToken(device).catch((error: unknown) => {
      spin.stop("Login failed");
      throw error;
    });

    await saveConfig({ registry, token, githubLogin });
    spin.stop(`Logged in as ${githubLogin}`);
    p.outro("Done.");
  },
});
