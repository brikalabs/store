import { inject } from "@brika/di";
import { reply } from "@brika/router";
import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed, runHandler } from "@/server/http";
import { REG_DB } from "@/server/tokens";

/** `GET /api/scopes` - the scopes the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);
          const scopes = await listScopesForMember(inject(REG_DB), "github", a.user.login);
          return reply({ scopes });
        }),
    },
  },
});
