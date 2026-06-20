import { revokeTokenByHash } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonNotFound, jsonPrivate } from "@/lib/http";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

/**
 * `DELETE /api/account/tokens/:hash` - revoke one of the signed-in user's tokens by its
 * hash. The query is subject-scoped, so a user can only revoke their own token; an unknown
 * or someone else's token is a 404.
 */
export const Route = createFileRoute("/api/account/tokens/$hash")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const removed = await revokeTokenByHash(
            registryDb(),
            "github",
            a.user.login,
            params.hash,
          );
          if (!removed) return jsonNotFound();
          return jsonPrivate({ ok: true });
        }),
    },
  },
});
