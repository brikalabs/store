import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { clearToken, loadConfig } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const logout = defineCommand({
  name: "logout",
  description: "Revoke the token and remove it locally",
  async handler() {
    const { token, registry } = await loadConfig();
    if (token !== undefined) {
      await new RegistryClient(registry).revokeToken(token);
    }
    await clearToken();
    p.log.success(token === undefined ? "Logged out." : "Logged out (token revoked).");
  },
});
