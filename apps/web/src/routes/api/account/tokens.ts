import { listSubjectTokens } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

/**
 * `GET  /api/account/tokens` - the signed-in user's publish tokens (metadata only; the
 * plaintext is never stored). `POST` issues a new token and returns its plaintext ONCE.
 */
export const Route = createFileRoute("/api/account/tokens")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);
          const tokens = await listSubjectTokens(registryDb(), "github", a.user.login);
          return jsonPrivate({ tokens });
        }),
      POST: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);
          const token = await a.svc.tokens.issue(a.user.login);
          return jsonPrivate({ token }, 201);
        }),
    },
  },
});
