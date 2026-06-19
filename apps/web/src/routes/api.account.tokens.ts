import { listSubjectTokens } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed } from "../lib/console-api";
import { jsonPrivate } from "../lib/http";
import { registryDb } from "../lib/registry-services";

/**
 * `GET  /api/account/tokens` - the signed-in user's publish tokens (metadata only; the
 * plaintext is never stored). `POST` issues a new token and returns its plaintext ONCE.
 */
export const Route = createFileRoute("/api/account/tokens")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const tokens = await listSubjectTokens(registryDb(), "github", a.user.login);
        return jsonPrivate({ tokens });
      },
      POST: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const token = await a.svc.tokens.issue(a.user.login);
        return jsonPrivate({ token }, 201);
      },
    },
  },
});
