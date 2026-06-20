import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

/**
 * Trusted-publisher bindings for an owned scope (PUB-016), admin-gated by the OrgService.
 *   GET    /api/orgs/:org/scopes/:scope/trusted-publishers   list
 *   PUT    /api/orgs/:org/scopes/:scope/trusted-publishers   add    { provider, repository, workflow }
 *   DELETE /api/orgs/:org/scopes/:scope/trusted-publishers   remove { provider, repository, workflow }
 */
const Body = z.object({
  provider: z.enum(["github", "gitlab"]),
  repository: z.string().regex(/^[^\s]+\/[^\s]+$/, "repository must be 'owner/repo'"),
  workflow: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/, "workflow must be a workflow filename, e.g. publish.yml"),
});

export const Route = createFileRoute("/api/orgs/$org/scopes/$scope/trusted-publishers")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const { publishers } = unwrap(
            await a.svc.orgs.listTrustedPublishers(a.identity, params.org, params.scope),
          );
          return jsonPrivate({ org: params.org, scope: params.scope, publishers });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { publisher } = unwrap(
            await a.svc.orgs.addTrustedPublisher(a.identity, params.org, params.scope, binding),
          );
          await a.svc.audit.record({
            action: "org_trusted_publisher_add",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { org: params.org, ...binding },
          });
          return jsonPrivate({ ok: true, publisher }, 201);
        }),
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const binding = parseBody(Body, await request.json(), "Invalid trusted publisher");
          const { removed } = unwrap(
            await a.svc.orgs.removeTrustedPublisher(a.identity, params.org, params.scope, binding),
          );
          await a.svc.audit.record({
            action: "org_trusted_publisher_remove",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { org: params.org, ...binding },
          });
          return jsonPrivate({ ok: true, removed });
        }),
    },
  },
});
