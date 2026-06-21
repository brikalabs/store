import { inject } from "@brika/di";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runAuthed } from "@/server/http";
import { Tokens } from "@/server/registry-services";
import { PublishTokenStore } from "@/server/stores/publish-token-store";

/**
 * `GET  /api/account/tokens` - the signed-in user's publish tokens (metadata only; the
 * plaintext is never stored). `POST` issues a new token and returns its plaintext ONCE.
 */
export const Route = createFileRoute("/api/account/tokens")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          const tokens = await inject(PublishTokenStore).listSubjectTokens("github", a.user.login);
          return reply({ tokens });
        }),
      POST: ({ request }) =>
        runAuthed(request, async (a) => {
          const token = await inject(Tokens).issue(a.user.login);
          return reply({ token }, 201);
        }),
    },
  },
});
