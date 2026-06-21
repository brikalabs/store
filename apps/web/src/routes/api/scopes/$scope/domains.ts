import { domainChallengeHost } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { DomainBody, shapeDomains } from "@/lib/scope-domains";
import { runAuthed } from "@/server/http";

/**
 * Scope domain claims (ORG-010), all admin-gated except the member-readable list:
 *   GET    /api/scopes/:scope/domains          list claimed domains (+ the TXT host/value)
 *   PUT    /api/scopes/:scope/domains {domain}  claim a domain; returns the TXT host/value
 *   POST   /api/scopes/:scope/domains {domain}  re-check DNS and verify
 *   DELETE /api/scopes/:scope/domains {domain}  drop a claimed domain
 */
export const Route = createFileRoute("/api/scopes/$scope/domains")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const result = okOrThrow(await a.svc.scopes.listDomains(a.identity, params.scope));
          const domains = await shapeDomains(a.svc.scopes, params.scope, result.domains);
          return reply({ scope: params.scope, domains });
        }),
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const { domain } = parseBody(DomainBody, await request.json(), "Invalid domain");
          const result = okOrThrow(await a.svc.scopes.addDomain(a.identity, params.scope, domain));
          await a.svc.audit.record({
            action: "scope_domain_add",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { domain },
          });
          return reply(
            {
              ok: true,
              domain: result.domain,
              host: domainChallengeHost(domain),
              txt: await a.svc.scopes.domainChallenge(params.scope, domain),
            },
            201,
          );
        }),
      POST: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = parseBody(DomainBody, await request.json(), "Invalid domain");
          const result = okOrThrow(
            await a.svc.scopes.verifyDomain(a.identity, params.scope, parsed.domain),
          );
          if (result.verified) {
            await a.svc.audit.record({
              action: "scope_domain_verified",
              packageName: params.scope,
              version: null,
              actor: a.identity,
              detail: { domain: parsed.domain },
            });
          }
          return reply({ ok: true, domain: result.domain, verified: result.verified });
        }),
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = parseBody(DomainBody, await request.json(), "Invalid domain");
          okOrThrow(await a.svc.scopes.removeDomain(a.identity, params.scope, parsed.domain));
          await a.svc.audit.record({
            action: "scope_domain_remove",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { domain: parsed.domain },
          });
          return reply({ ok: true, removed: parsed.domain });
        }),
    },
  },
});
