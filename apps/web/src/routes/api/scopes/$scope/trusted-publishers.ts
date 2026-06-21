import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runAuthed } from "@/server/http";
import { Audit } from "@/server/registry-services";

/**
 * Trusted-publisher bindings for a scope (PUB-016), admin-gated by the ScopeService.
 *   GET    /api/scopes/:scope/trusted-publishers   list
 *   PUT    /api/scopes/:scope/trusted-publishers   add    { provider, repository, workflow }
 *   DELETE /api/scopes/:scope/trusted-publishers   remove { provider, repository, workflow }
 */
const Body = z.object({
  provider: z.enum(["github", "gitlab"]),
  repository: z.string().regex(/^[^\s/]+(?:\/[^\s/]+)+$/, "repository must be 'owner/repo'"),
  workflow: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/, "workflow must be a workflow filename, e.g. publish.yml"),
});

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
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { publisher } = okOrThrow(
            await inject(ScopeService).addTrustedPublisher(a.identity, params.scope, binding),
          );
          await inject(Audit).record({
            action: "scope_trusted_publisher_add",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: binding,
          });
          return reply({ ok: true, publisher }, 201);
        }),
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { removed } = okOrThrow(
            await inject(ScopeService).removeTrustedPublisher(a.identity, params.scope, binding),
          );
          await inject(Audit).record({
            action: "scope_trusted_publisher_remove",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: binding,
          });
          return reply({ ok: true, removed });
        }),
    },
  },
});
