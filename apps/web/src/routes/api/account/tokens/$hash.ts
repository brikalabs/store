import { inject } from "@brika/di";
import { notFound, reply } from "@brika/router";
import { revokeTokenByHash } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed, runHandler } from "@/server/http";
import { RegistryDatabase } from "@/server/registry-services";

/**
 * `DELETE /api/account/tokens/:hash` - revoke one of the signed-in user's tokens by its
 * hash. The query is subject-scoped, so a user can only revoke their own token; an unknown
 * or someone else's token is a 404.
 */
export const Route = createFileRoute("/api/account/tokens/$hash")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runHandler(async () => {
          const a = await authed(request);
          const removed = await revokeTokenByHash(
            inject(RegistryDatabase).orm,
            "github",
            a.user.login,
            params.hash,
          );
          if (!removed) throw notFound();
          return reply({ ok: true });
        }),
    },
  },
});
