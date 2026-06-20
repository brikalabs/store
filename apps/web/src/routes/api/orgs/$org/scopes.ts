import { isCanonicalScope } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonPrivate, orgStatus } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

const AttachBody = z.object({ scope: z.string().min(1) });

/**
 * `GET /api/orgs/:org/scopes` - the npm scopes the org owns (any member; ORG-008-AC1).
 * `PUT /api/orgs/:org/scopes` - attach a scope to the org (admin only; ORG-008-AC2/AC3),
 * refusing a scope already owned by another org (409).
 */
export const Route = createFileRoute("/api/orgs/$org/scopes")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const result = unwrap(await a.svc.orgs.listScopes(a.identity, params.org), orgStatus);
          return jsonPrivate({ org: params.org, scopes: result.scopes });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(
            AttachBody,
            await request.json(),
            "Scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
          );
          if (!isCanonicalScope(parsed.scope)) {
            return jsonBadRequest(
              "Scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
            );
          }
          const result = unwrap(
            await a.svc.orgs.attachScope(a.identity, params.org, parsed.scope),
            orgStatus,
          );
          await a.svc.audit.record({
            action: "org_scope_attach",
            packageName: parsed.scope,
            version: null,
            actor: a.identity,
            detail: { org: params.org },
          });
          return jsonPrivate({ ok: true, org: params.org, scope: result.scope }, 201);
        }),
    },
  },
});
