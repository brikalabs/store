import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed } from "@/server/console-api";

/**
 * Trusted-publisher bindings for an owned scope (PUB-016), admin-gated by the OrgService.
 *   GET    /api/orgs/:org/scopes/:scope/trusted-publishers   list
 *   PUT    /api/orgs/:org/scopes/:scope/trusted-publishers   add    { repository, workflow }
 *   DELETE /api/orgs/:org/scopes/:scope/trusted-publishers   remove { repository, workflow }
 */
const Body = z.object({
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repository must be 'owner/repo'"),
  workflow: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/, "workflow must be a workflow filename, e.g. publish.yml"),
});

export const Route = createFileRoute("/api/orgs/$org/scopes/$scope/trusted-publishers")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.orgs.listTrustedPublishers(a.identity, params.org, params.scope);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        return jsonPrivate({ org: params.org, scope: params.scope, publishers: result.publishers });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) {
          return jsonBadRequest(parsed.error.issues[0]?.message ?? "Invalid trusted publisher");
        }
        const result = await a.svc.orgs.addTrustedPublisher(
          a.identity,
          params.org,
          params.scope,
          parsed.data.repository,
          parsed.data.workflow,
        );
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_trusted_publisher_add",
          packageName: params.scope,
          version: null,
          actor: a.identity,
          detail: { org: params.org, ...parsed.data },
        });
        return jsonPrivate({ ok: true, publisher: result.publisher }, 201);
      },
      DELETE: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid trusted publisher");
        const result = await a.svc.orgs.removeTrustedPublisher(
          a.identity,
          params.org,
          params.scope,
          parsed.data.repository,
          parsed.data.workflow,
        );
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_trusted_publisher_remove",
          packageName: params.scope,
          version: null,
          actor: a.identity,
          detail: { org: params.org, ...parsed.data },
        });
        return jsonPrivate({ ok: true, removed: result.removed });
      },
    },
  },
});
