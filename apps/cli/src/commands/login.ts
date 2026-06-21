import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { openBrowser } from "../lib/browser";
import { copyToClipboard } from "../lib/clipboard";
import { loadConfig, saveConfig } from "../lib/config";
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
    const { registry } = await loadConfig();
    const client = new RegistryClient(registry);

    p.intro("brika login");
    const device = await client.requestDeviceCode();
    p.note(`${device.verification_uri}\n\nCode:  ${device.user_code}`, "Authorize this device");

    // Open the approval page directly. `verification_uri_complete` carries the
    // code in the URL so the page can pre-fill it; the note above is the manual
    // fallback when the browser cannot be opened (CI, SSH, `--no-browser`).
    const approvalUrl = device.verification_uri_complete ?? device.verification_uri;
    const opened = values.noBrowser ? false : await openBrowser(approvalUrl);
    if (opened) {
      p.log.info("Opened your browser to finish login.");
    } else {
      // No browser (CI, SSH, --no-browser, or no opener): copy the code so the
      // user only has to open the URL above and paste it.
      const copied = await copyToClipboard(device.user_code);
      p.log.info(
        copied
          ? "Code copied to your clipboard - open the URL above and paste it."
          : "Open the URL above and enter the code to continue.",
      );
    }

    const spin = p.spinner();
    spin.start("Waiting for approval");
    const { token, githubLogin, displayName } = await client
      .waitForToken(device)
      .catch((error: unknown) => {
        spin.stop("Login failed");
        throw error;
      });

    await saveConfig({ registry, token, githubLogin, displayName: displayName ?? undefined });
    spin.stop(`Logged in as ${displayName ?? githubLogin}`);
    p.outro("Done.");
  },
});
