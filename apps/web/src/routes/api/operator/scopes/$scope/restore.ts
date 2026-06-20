import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, runJson, unwrap } from "@/server/console-api";

/** `POST /api/operator/scopes/:scope/restore` - reverse a scope takedown (ORG-007). Operator-gated. */
export const Route = createFileRoute("/api/operator/scopes/$scope/restore")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          unwrap(await a.svc.scopes.restore(params.scope));
          await a.svc.audit.record({
            action: "scope_restore",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: null,
          });
          return jsonPrivate({ ok: true, scope: params.scope, takedown: null });
        }),
    },
  },
});
