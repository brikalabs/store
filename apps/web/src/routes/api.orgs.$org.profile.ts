import { orgDescriptionSchema, orgLinksSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "../lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "../lib/http";

const Body = z.object({
  description: orgDescriptionSchema.nullable(),
  links: orgLinksSchema,
});

/** `PUT /api/orgs/:org/profile` - set the org's description + links (admin only; ORG-009). */
export const Route = createFileRoute("/api/orgs/$org/profile")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid description or links");
        const result = await a.svc.orgs.setProfile(a.identity, params.org, {
          description: parsed.data.description,
          links: parsed.data.links,
        });
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_profile_set",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { links: parsed.data.links.length },
        });
        return jsonPrivate({ ok: true, org: params.org, profile: result.profile });
      },
    },
  },
});
