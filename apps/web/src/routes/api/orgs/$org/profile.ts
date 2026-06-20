import { orgDescriptionSchema, orgLinksSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({
  description: orgDescriptionSchema.nullable(),
  links: orgLinksSchema,
});

/** `PUT /api/orgs/:org/profile` - set the org's description + links (admin only; ORG-009). */
export const Route = createFileRoute("/api/orgs/$org/profile")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid description or links");
          const result = unwrap(
            await a.svc.orgs.setProfile(a.identity, params.org, {
              description: parsed.description,
              links: parsed.links,
            }),
          );
          await a.svc.audit.record({
            action: "org_profile_set",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { links: parsed.links.length },
          });
          return jsonPrivate({ ok: true, org: params.org, profile: result.profile });
        }),
    },
  },
});
