import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { authToken, clearToken, loadConfig, registryUrl } from "../lib/config";
import { RegistryClient } from "../lib/registry";

export const logout = defineCommand({
  name: "logout",
  description: "Revoke the token and remove it locally",
  async handler() {
    const config = await loadConfig();
    const token = authToken(config);
    if (token !== undefined) {
      await new RegistryClient(registryUrl(config)).revokeToken(token);
    }
    await clearToken();
    p.log.success(token !== undefined ? "Logged out (token revoked)." : "Logged out.");
  },
});
