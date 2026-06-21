import { inject } from "@brika/di";
import {
  GITHUB_ISSUER,
  GITLAB_ISSUER,
  githubIdentity,
  gitlabIdentity,
  isOperator,
  type OidcIdentity,
  type PublishIdentity,
  peekIssuer,
  type TokenStore,
  verifyGithubOidc,
  verifyGitlabOidc,
} from "@brika/registry-core";
import { forbidden, type RateLimitKey, unauthorized } from "@brika/router";
import { CachingJwksProvider } from "./adapters/jwks";
import { Tokens } from "./services";

/**
 * Shared write-authentication for the registry's mutating endpoints (publish,
 * deprecate, yank). Accepts EITHER a CI OIDC token (GitHub or GitLab, audience
 * `brika-registry`) OR a registry publish token (local `brika` CLI). Returns the
 * resolved publish identity, or null when neither credential validates.
 */

export const AUDIENCE = "brika-registry";

const githubJwks = new CachingJwksProvider(
  "https://token.actions.githubusercontent.com/.well-known/jwks",
);
const gitlabJwks = new CachingJwksProvider("https://gitlab.com/oauth/discovery/keys");

/**
 * Verify a CI OIDC token against the provider its issuer names (GitHub or GitLab), returning
 * a normalized identity, or null. Dispatching on the (unverified) issuer means we fetch only
 * the right provider's JWKS and never accept a token whose issuer we don't recognize.
 */
async function verifyCiOidc(token: string): Promise<OidcIdentity | null> {
  switch (peekIssuer(token)) {
    case GITHUB_ISSUER: {
      const claims = await verifyGithubOidc(token, githubJwks, { audience: AUDIENCE });
      return claims === null ? null : githubIdentity(claims);
    }
    case GITLAB_ISSUER: {
      const claims = await verifyGitlabOidc(token, gitlabJwks, { audience: AUDIENCE });
      return claims === null ? null : gitlabIdentity(claims);
    }
    default:
      return null;
  }
}

export async function authenticateWrite(
  request: Request,
  tokens: TokenStore,
): Promise<PublishIdentity | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);

  const ci = await verifyCiOidc(token);
  if (ci !== null) {
    return {
      provider: ci.provider,
      owner: ci.owner,
      repository: ci.repository,
      // Provenance is the verified CI build context (it cannot be forged).
      provenance: {
        repository: ci.repository,
        sha: ci.sha,
        ref: ci.ref,
        workflowRef: ci.workflowRef,
        runId: ci.runId,
      },
    };
  }

  const tokenUser = await tokens.verify(token);
  if (tokenUser !== null) {
    return { provider: tokenUser.provider, owner: tokenUser.subject, repository: null };
  }

  return null;
}

/**
 * Like {@link authenticateWrite}, but throws `401 Unauthorized` instead of
 * returning `null`, so a handler reads the identity in one line:
 * `const identity = await requireWrite(req, inject(Tokens))`.
 *
 * Memoized per request (keyed by the `Request`): the rate-limit middleware and the
 * handler both call it, but the OIDC/JWKS verification runs only once. The cache
 * is a `WeakMap`, so entries are collected with their request.
 */
const identityByRequest = new WeakMap<Request, Promise<PublishIdentity>>();

export function requireWrite(request: Request, tokens: TokenStore): Promise<PublishIdentity> {
  const cached = identityByRequest.get(request);
  if (cached !== undefined) return cached;
  const resolved = authenticateWrite(request, tokens).then((identity) => {
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
 * the memoized {@link requireWrite}, so it adds no extra verification. Runs inside the
 * per-request injection context (the `mount({ around })` wrapper), so `inject` is valid.
 */
export const principal: RateLimitKey<void> = async ({ req }) => {
  const identity = await requireWrite(req, inject(Tokens));
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
  tokens: TokenStore,
  admins: ReadonlySet<string>,
): Promise<PublishIdentity> {
  const identity = await requireWrite(request, tokens);
  if (!isOperator(admins, identity)) throw forbidden("Not a registry admin");
  return identity;
}
