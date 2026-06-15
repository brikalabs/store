import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { openBrowser } from "../lib/browser";
import { loadConfig, registryUrl, saveConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const login = defineCommand({
  name: "login",
  description: "Authorize this machine (GitHub device flow)",
  options: {
    "no-browser": {
      type: "boolean",
      default: false,
      description: "Print the verification URL instead of opening a browser",
    },
  },
  examples: ["brika login", "brika login --no-browser"],
  async handler({ values }) {
    const config = await loadConfig();
    const registry = registryUrl(config);
    const client = new RegistryClient(registry);

    p.intro("brika login");
    const device = await client.requestDeviceCode();
    p.note(`${device.verification_uri}\n\nCode:  ${device.user_code}`, "Authorize this device");

    // Open the approval page directly. `verification_uri_complete` carries the
    // code in the URL so the page can pre-fill it; the note above is the manual
    // fallback when the browser cannot be opened (CI, SSH, `--no-browser`).
    const approvalUrl = device.verification_uri_complete ?? device.verification_uri;
    if (values.noBrowser) {
      p.log.info("Open the URL above and enter the code to continue.");
    } else if (await openBrowser(approvalUrl)) {
      p.log.info("Opened your browser to finish login.");
    } else {
      p.log.warn("Could not open a browser - open the URL above and enter the code.");
    }

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
