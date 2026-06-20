import { isCanonicalScope } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed } from "@/server/console-api";

const AttachBody = z.object({ scope: z.string().min(1) });

/**
 * `GET /api/orgs/:org/scopes` - the npm scopes the org owns (any member; ORG-008-AC1).
 * `PUT /api/orgs/:org/scopes` - attach a scope to the org (admin only; ORG-008-AC2/AC3),
 * refusing a scope already owned by another org (409).
 */
export const Route = createFileRoute("/api/orgs/$org/scopes")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.orgs.listScopes(a.identity, params.org);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        return jsonPrivate({ org: params.org, scopes: result.scopes });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = AttachBody.safeParse(await request.json());
        if (!parsed.success || !isCanonicalScope(parsed.data.scope)) {
          return jsonBadRequest(
            "Scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
          );
        }
        const result = await a.svc.orgs.attachScope(a.identity, params.org, parsed.data.scope);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_scope_attach",
          packageName: parsed.data.scope,
          version: null,
          actor: a.identity,
          detail: { org: params.org },
        });
        return jsonPrivate({ ok: true, org: params.org, scope: result.scope }, 201);
      },
    },
  },
});
