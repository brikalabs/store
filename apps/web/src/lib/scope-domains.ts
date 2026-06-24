import { inject } from "@brika/di";
import {
  domainChallengeHost,
  type ScopeDomainRecord,
  type ScopeService,
  scopeDomainSchema,
} from "@brika/registry-core";
import { readBody } from "@brika/router";
import { z } from "zod";
import { ServerT } from "@/server/i18n";

export const DomainBody = z.object({ domain: scopeDomainSchema });

/** Read + validate a domain-claim request body, with a locale-aware "invalid domain" message. */
export function readDomainBody(request: Request): Promise<z.infer<typeof DomainBody>> {
  return readBody(request, DomainBody, inject(ServerT).t("api:invalidDomain"));
}

/** Claimed domains plus the derived TXT host + value each must publish to verify (ORG-010). */
export function shapeDomains(
  scopes: ScopeService,
  scope: string,
  domains: readonly ScopeDomainRecord[],
): Promise<Array<ScopeDomainRecord & { host: string; txt: string }>> {
  return Promise.all(
    domains.map(async (d) => ({
      ...d,
      host: domainChallengeHost(d.domain),
      txt: await scopes.domainChallenge(scope, d.domain),
    })),
  );
}
