import { inject } from "@brika/di";
import { ScopeService, trustedPublisherSchema } from "@brika/registry-core";
import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { readJsonBody, recordAudit, runAuthed } from "@/server/http";

/**
 * Trusted-publisher bindings for a scope (PUB-016), admin-gated: GET lists, PUT adds, DELETE removes
 * a `{ provider, repository, workflow }` binding.
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
          const binding = await readJsonBody(
            request,
            trustedPublisherSchema,
            "api:invalidTrustedPublisher",
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
          const binding = await readJsonBody(
            request,
            trustedPublisherSchema,
            "api:invalidTrustedPublisher",
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
