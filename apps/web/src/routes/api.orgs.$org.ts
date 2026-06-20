import { isCanonicalOrgSlug } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { authed } from "@/lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";

/**
 * `GET /api/orgs/:org` - the org's editable profile (display name, description, links,
 * icon presence), for hydrating the console editor. `PUT` claims the org.
 */
export const Route = createFileRoute("/api/orgs/$org")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const info = await a.svc.orgs.getPublic(params.org);
        if (info === null) return jsonError(404, `organisation ${params.org} does not exist`);
        return jsonPrivate({
          slug: info.slug,
          displayName: info.displayName,
          description: info.description,
          links: info.links,
          hasIcon: info.iconKey !== null,
        });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const { org } = params;
        if (!isCanonicalOrgSlug(org)) {
          return jsonBadRequest(
            "Org slug must be 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
          );
        }
        const result = await a.svc.orgs.claim(a.identity, org);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        if (result.created) {
          await a.svc.audit.record({
            action: "org_create",
            packageName: org,
            version: null,
            actor: a.identity,
            detail: null,
          });
        }
        return jsonPrivate({ ok: true, org, created: result.created }, result.created ? 201 : 200);
      },
    },
  },
});
