import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

/** `GET /api/scopes` - the scopes the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);
          const scopes = await listScopesForMember(registryDb(), "github", a.user.login);
          return jsonPrivate({ scopes });
        }),
    },
  },
});
