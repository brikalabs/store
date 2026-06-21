import { inject } from "@brika/di";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { authed, runHandler } from "@/server/http";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/** `GET /api/scopes` - the scopes the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);
          const scopes = await inject(ScopeMembershipStore).listScopesForMember(
            "github",
            a.user.login,
          );
          return reply({ scopes });
        }),
    },
  },
});
