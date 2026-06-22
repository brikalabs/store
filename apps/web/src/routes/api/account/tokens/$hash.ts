import { inject } from "@brika/di";
import { notFound, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runAuthed } from "@/server/http";
import { PublishTokenStore } from "@/server/stores/publish-token-store";

/**
 * `DELETE /api/account/tokens/:hash` - revoke one of the signed-in user's tokens by hash. The query
 * is account-scoped, so a user can only revoke their own; an unknown or someone else's token is a 404.
 */
export const Route = createFileRoute("/api/account/tokens/$hash")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const removed = await inject(PublishTokenStore).revokeTokenByHash(a.user.id, params.hash);
          if (!removed) throw notFound();
          return reply({ ok: true });
        }),
    },
  },
});
