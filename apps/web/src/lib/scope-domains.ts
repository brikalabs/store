import {
  domainChallengeHost,
  type ScopeDomainRecord,
  type ScopeService,
  scopeDomainSchema,
} from "@brika/registry-core";
import { z } from "zod";

export const DomainBody = z.object({ domain: scopeDomainSchema });

/**
 * A claimed domain plus the (derived) TXT host + value it must publish to verify (ORG-010).
 * Resolved per domain so the route's GET handler stays a thin list+serialize.
 */
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
