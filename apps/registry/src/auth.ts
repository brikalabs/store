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
import { Admins, Tokens } from "./services";

export const AUDIENCE = "brika-registry";

const githubJwks = new CachingJwksProvider(
  "https://token.actions.githubusercontent.com/.well-known/jwks",
);
const gitlabJwks = new CachingJwksProvider("https://gitlab.com/oauth/discovery/keys");

/**
 * Verify a CI OIDC token against the provider its issuer names (GitHub or GitLab), or null.
 * Dispatching on the issuer fetches only the right JWKS and never accepts an unrecognized issuer.
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

/**
 * Authenticate a mutating request by EITHER a CI OIDC token (GitHub/GitLab, audience
 * `brika-registry`) OR a registry publish token. Returns the identity, or null if neither validates.
 */
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
      userId: null,
      provider: ci.provider,
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
    return { userId: tokenUser.userId, provider: null, repository: null };
  }

  return null;
}

/**
 * Like {@link authenticateWrite}, but throws `401` instead of returning null. Memoized per request
 * (WeakMap by `Request`) so the rate-limit middleware and handler share one OIDC/JWKS verification.
 */
const identityByRequest = new WeakMap<Request, Promise<PublishIdentity>>();

export function requireWrite(
  request: Request,
  tokens: TokenStore = inject(Tokens),
): Promise<PublishIdentity> {
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
 * A `rateLimit` key strategy keyed by authenticated principal (OIDC repository, else token owner):
 * CI shares GitHub Actions egress IPs, so a per-IP key would throttle unrelated repos.
 */
export const principal: RateLimitKey<void> = async ({ req }) => {
  const identity = await requireWrite(req);
  return identity.repository ?? identity.userId ?? "unknown";
};

/**
 * Authenticate an operator admin for takedown/restore: a valid write credential whose account id is
 * in the `admins` allowlist. Throws `401` if no credential validates, `403` if it is not an admin.
 * A CI/OIDC credential has no account id, so it can never be an operator. Admin is a registry-operator
 * role, deliberately separate from scope ownership.
 */
export async function requireAdmin(
  request: Request,
  tokens: TokenStore = inject(Tokens),
  admins: ReadonlySet<string> = inject(Admins),
): Promise<PublishIdentity> {
  const identity = await requireWrite(request, tokens);
  if (!isOperator(admins, identity)) throw forbidden("Not a registry admin");
  return identity;
}
