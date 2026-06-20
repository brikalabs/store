import { isCanonicalOrgSlug } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed, runJson, unwrap } from "@/server/console-api";

/**
 * `GET /api/orgs/:org` - the org's editable profile (display name, description, links,
 * icon presence), for hydrating the console editor. `PUT` claims the org.
 */
export const Route = createFileRoute("/api/orgs/$org")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const info = await a.svc.orgs.getPublic(params.org);
          if (info === null) return jsonError(404, `organisation ${params.org} does not exist`);
          return jsonPrivate({
            slug: info.slug,
            displayName: info.displayName,
            description: info.description,
            links: info.links,
            hasIcon: info.iconKey !== null,
          });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const { org } = params;
          if (!isCanonicalOrgSlug(org)) {
            return jsonBadRequest(
              "Org slug must be 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
            );
          }
          const result = unwrap(await a.svc.orgs.claim(a.identity, org), orgStatus);
          if (result.created) {
            await a.svc.audit.record({
              action: "org_create",
              packageName: org,
              version: null,
              actor: a.identity,
              detail: null,
            });
          }
          return jsonPrivate(
            { ok: true, org, created: result.created },
            result.created ? 201 : 200,
          );
        }),
    },
  },
});
