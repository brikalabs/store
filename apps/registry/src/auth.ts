import { type OidcClaims, type PublishIdentity, verifyGithubOidc } from "@brika/registry-core";
import { unauthorized } from "@brika/router";
import type { Db } from "@brika/store-db";
import { GithubJwksProvider } from "./adapters/github-jwks";
import { verifyToken } from "./adapters/token";

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
      owner: claims.repository_owner,
      repository: claims.repository,
      provenance: provenanceFrom(claims),
    };
  }

  const tokenUser = await verifyToken(db, token);
  if (tokenUser !== null) return { owner: tokenUser.githubLogin, repository: null };

  return null;
}

/**
 * Like {@link authenticateWrite}, but throws `401 Unauthorized` instead of
 * returning `null`, so a handler reads the identity in one line:
 * `const identity = await requireWrite(req, db)`.
 */
export async function requireWrite(request: Request, db: Db): Promise<PublishIdentity> {
  const identity = await authenticateWrite(request, db);
  if (identity === null) throw unauthorized();
  return identity;
}
