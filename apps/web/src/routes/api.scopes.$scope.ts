import { isCanonicalScope } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { authed } from "../lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, scopeStatus } from "../lib/http";

/** `PUT /api/scopes/:scope` - create/claim a scope (caller becomes its first admin). */
export const Route = createFileRoute("/api/scopes/$scope")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const { scope } = params;
        if (!isCanonicalScope(scope)) {
          return jsonBadRequest(
            "Scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
          );
        }
        const result = await a.svc.scopes.claim(a.identity, scope);
        if (!result.ok) return jsonError(scopeStatus(result.code), result.message);
        if (result.created) {
          await a.svc.audit.record({
            action: "scope_create",
            packageName: scope,
            version: null,
            actor: a.identity,
            detail: null,
          });
        }
        return jsonPrivate(
          { ok: true, scope, owner: result.owner, created: result.created },
          result.created ? 201 : 200,
        );
      },
    },
  },
});
