import { type OidcClaims, type PublishIdentity, verifyGithubOidc } from "@brika/registry-core";
import { forbidden, type RateLimitKey, unauthorized } from "@brika/router";
import type { Db } from "@brika/store-db";
import { GithubJwksProvider } from "./adapters/github-jwks";
import { verifyToken } from "./adapters/token";
import type { Services } from "./services";

/**
 * Shared write-authentication for the registry's mutating endpoints (publish,
 * deprecate, yank). Accepts EITHER a GitHub Actions OIDC token (CI, audience
 * `brika-registry`) OR a registry publish token (local `brika` CLI). Returns the
 * resolved publish identity, or null when neither credential validates.
 */

export const AUDIENCE = "brika-registry";

const jwks = new GithubJwksProvider();

/** Build CI provenance from the verified OIDC claims (it cannot be forged). */
function provenanceFrom(claims: OidcClaims) {
  return {
    repository: claims.repository,
    sha: claims.sha,
    ref: claims.ref,
    workflowRef: claims.workflow_ref,
    runId: claims.run_id,
  };
}

export async function authenticateWrite(request: Request, db: Db): Promise<PublishIdentity | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);

  const claims = await verifyGithubOidc(token, jwks, { audience: AUDIENCE });
  if (claims !== null) {
    return {
      provider: "github",
      owner: claims.repository_owner,
      repository: claims.repository,
      provenance: provenanceFrom(claims),
    };
  }

  const tokenUser = await verifyToken(db, token);
  if (tokenUser !== null) {
    return { provider: tokenUser.provider, owner: tokenUser.subject, repository: null };
  }

  return null;
}

/**
 * Like {@link authenticateWrite}, but throws `401 Unauthorized` instead of
 * returning `null`, so a handler reads the identity in one line:
 * `const identity = await requireWrite(req, db)`.
 *
 * Memoized per request (keyed by the `Request`): the rate-limit middleware and the
 * handler both call it, but the OIDC/JWKS verification runs only once. The cache
 * is a `WeakMap`, so entries are collected with their request.
 */
const identityByRequest = new WeakMap<Request, Promise<PublishIdentity>>();

export function requireWrite(request: Request, db: Db): Promise<PublishIdentity> {
  const cached = identityByRequest.get(request);
  if (cached !== undefined) return cached;
  const resolved = authenticateWrite(request, db).then((identity) => {
    if (identity === null) throw unauthorized();
    return identity;
  });
  identityByRequest.set(request, resolved);
  return resolved;
}

/**
 * A `rateLimit` key strategy that keys by the authenticated principal: the OIDC
 * repository, else the token owner. For publish-style endpoints, where CI shares
 * GitHub Actions egress IPs so a per-IP key would throttle unrelated repos. Reuses
 * the memoized {@link requireWrite}, so it adds no extra verification.
 */
export const principal: RateLimitKey<Services> = async ({ req, ctx }) => {
  const identity = await requireWrite(req, ctx.db);
  return identity.repository ?? identity.owner;
};

/**
 * Authenticate an operator admin for takedown/restore: a valid write credential
 * (OIDC or token) whose provider-qualified identity is in the `admins` allowlist (the
 * controller passes it from `REGISTRY_ADMINS`, as `provider:owner` keys). Throws `401`
 * when no credential validates, `403` when it validates but is not an admin. Matching
 * the full `provider:owner` (not the bare owner) keeps the check correct once a second
 * identity provider exists, so a `gitlab` user cannot inherit a `github` admin's slot.
 * Admin is a registry-operator role, deliberately separate from (and overriding) scope
 * ownership. The allowlist is a parameter so this stays free of the env import.
 */
export async function requireAdmin(
  request: Request,
  db: Db,
  admins: ReadonlySet<string>,
): Promise<PublishIdentity> {
  const identity = await requireWrite(request, db);
  if (!admins.has(`${identity.provider}:${identity.owner}`))
    throw forbidden("Not a registry admin");
  return identity;
}
