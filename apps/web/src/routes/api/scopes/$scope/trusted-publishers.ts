import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

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
        runJson(async () => {
          const a = await authed(request);
          const { publishers } = unwrap(
            await a.svc.scopes.listTrustedPublishers(a.identity, params.scope),
          );
          return jsonPrivate({ scope: params.scope, publishers });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { publisher } = unwrap(
            await a.svc.scopes.addTrustedPublisher(a.identity, params.scope, binding),
          );
          await a.svc.audit.record({
            action: "scope_trusted_publisher_add",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: binding,
          });
          return jsonPrivate({ ok: true, publisher }, 201);
        }),
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { removed } = unwrap(
            await a.svc.scopes.removeTrustedPublisher(a.identity, params.scope, binding),
          );
          await a.svc.audit.record({
            action: "scope_trusted_publisher_remove",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: binding,
          });
          return jsonPrivate({ ok: true, removed });
        }),
    },
  },
});
