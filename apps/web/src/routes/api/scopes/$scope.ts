import { isCanonicalScope } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonError, jsonPrivate } from "@/lib/http";
import { authed, runJson, unwrap } from "@/server/console-api";

/**
 * `GET /api/scopes/:scope` - the scope's editable profile (display name, description, links,
 * icon presence), for hydrating the console editor. `PUT` claims the scope (`@name`), making
 * the caller its first admin. The `:scope` param is the URL-encoded scope (`@brika` ->
 * `%40brika`).
 */
export const Route = createFileRoute("/api/scopes/$scope")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const info = await a.svc.scopes.getPublic(params.scope);
          if (info === null) return jsonError(404, `scope ${params.scope} does not exist`);
          return jsonPrivate({
            scope: info.scope,
            displayName: info.displayName,
            description: info.description,
            links: info.links,
            hasIcon: info.hasIcon,
          });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const { scope } = params;
          if (!isCanonicalScope(scope)) {
            return jsonBadRequest(
              "Scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
            );
          }
          const result = unwrap(await a.svc.scopes.claim(a.identity, scope));
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
            { ok: true, scope, created: result.created },
            result.created ? 201 : 200,
          );
        }),
    },
  },
});
