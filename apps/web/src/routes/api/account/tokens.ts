import { inject } from "@brika/di";
import { reply } from "@brika/router";
import { listSubjectTokens } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed, runHandler } from "@/server/http";
import { RegistryDatabase } from "@/server/registry-services";

/**
 * `GET  /api/account/tokens` - the signed-in user's publish tokens (metadata only; the
 * plaintext is never stored). `POST` issues a new token and returns its plaintext ONCE.
 */
export const Route = createFileRoute("/api/account/tokens")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);
          const tokens = await listSubjectTokens(
            inject(RegistryDatabase).orm,
            "github",
            a.user.login,
          );
          return reply({ tokens });
        }),
      POST: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);
          const token = await a.svc.tokens.issue(a.user.login);
          return reply({ token }, 201);
        }),
    },
  },
});
