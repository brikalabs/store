import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed } from "../lib/console-api";
import { jsonPrivate } from "../lib/http";
import { registryDb } from "../lib/registry-services";

/** `GET /api/scopes` - the scopes the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/scopes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const scopes = await listScopesForMember(registryDb(), "github", a.user.login);
        return jsonPrivate({ scopes });
      },
    },
  },
});
