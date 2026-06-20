import { domainChallengeHost, orgDomainSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "@/lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";

const DomainBody = z.object({ domain: orgDomainSchema });

/**
 * Org domain claims (ORG-010), all admin-gated except the member-readable list:
 *   GET    /api/orgs/:org/domains          list claimed domains (+ the TXT host/value)
 *   PUT    /api/orgs/:org/domains {domain}  claim a domain; returns the TXT host/value
 *   POST   /api/orgs/:org/domains {domain}  re-check DNS and verify
 *   DELETE /api/orgs/:org/domains {domain}  drop a claimed domain
 */
export const Route = createFileRoute("/api/orgs/$org/domains")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.orgs.listDomains(a.identity, params.org);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        // Surface the (derived) TXT host + value each pending domain must publish.
        const domains = await Promise.all(
          result.domains.map(async (d) => ({
            ...d,
            host: domainChallengeHost(d.domain),
            txt: await a.svc.orgs.domainChallenge(params.org, d.domain),
          })),
        );
        return jsonPrivate({ org: params.org, domains });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = DomainBody.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid domain");
        const { domain } = parsed.data;
        const result = await a.svc.orgs.addDomain(a.identity, params.org, domain);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_domain_add",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { domain },
        });
        return jsonPrivate(
          {
            ok: true,
            domain: result.domain,
            host: domainChallengeHost(domain),
            txt: await a.svc.orgs.domainChallenge(params.org, domain),
          },
          201,
        );
      },
      POST: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = DomainBody.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid domain");
        const result = await a.svc.orgs.verifyDomain(a.identity, params.org, parsed.data.domain);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        if (result.verified) {
          await a.svc.audit.record({
            action: "org_domain_verified",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { domain: parsed.data.domain },
          });
        }
        return jsonPrivate({ ok: true, domain: result.domain, verified: result.verified });
      },
      DELETE: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = DomainBody.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid domain");
        const result = await a.svc.orgs.removeDomain(a.identity, params.org, parsed.data.domain);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_domain_remove",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { domain: parsed.data.domain },
        });
        return jsonPrivate({ ok: true, removed: parsed.data.domain });
      },
    },
  },
});
