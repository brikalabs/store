import { inject } from "@brika/di";
import { ScopeService, trustedPublisherSchema } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { recordAudit, runAuthed } from "@/server/http";

/**
 * Trusted-publisher bindings for a scope (PUB-016), admin-gated by the ScopeService.
 *   GET    /api/scopes/:scope/trusted-publishers   list
 *   PUT    /api/scopes/:scope/trusted-publishers   add    { provider, repository, workflow }
 *   DELETE /api/scopes/:scope/trusted-publishers   remove { provider, repository, workflow }
 */
export const Route = createFileRoute("/api/scopes/$scope/trusted-publishers")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const { publishers } = okOrThrow(
            await inject(ScopeService).listTrustedPublishers(a.identity, params.scope),
          );
          return reply({ scope: params.scope, publishers });
        }),
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const binding = await readBody(
            request,
            trustedPublisherSchema,
            "Invalid trusted publisher",
          );
          const { publisher } = okOrThrow(
            await inject(ScopeService).addTrustedPublisher(a.identity, params.scope, binding),
          );
          await recordAudit(a, {
            action: "scope_trusted_publisher_add",
            packageName: params.scope,
            detail: binding,
          });
          return reply({ ok: true, publisher }, 201);
        }),
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const binding = await readBody(
            request,
            trustedPublisherSchema,
            "Invalid trusted publisher",
          );
          const { removed } = okOrThrow(
            await inject(ScopeService).removeTrustedPublisher(a.identity, params.scope, binding),
          );
          await recordAudit(a, {
            action: "scope_trusted_publisher_remove",
            packageName: params.scope,
            detail: binding,
          });
          return reply({ ok: true, removed });
        }),
    },
  },
});
