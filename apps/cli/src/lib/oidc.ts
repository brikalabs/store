/**
 * GitHub Actions OIDC, for tokenless "trusted publisher" publishing (PUB-016). In a workflow
 * with `permissions: id-token: write`, GitHub exposes an endpoint that mints a short-lived
 * OIDC JWT bound to the repo + workflow. We request one for the registry's audience and send
 * it as the publish bearer; the registry verifies it (issuer, audience, signature) and
 * authorizes against a trusted-publisher binding - so no long-lived token is stored anywhere.
 */

/** The audience the Brika registry expects on a GitHub OIDC token (matches the worker). */
export const REGISTRY_OIDC_AUDIENCE = "brika-registry";

/**
 * Request a GitHub Actions OIDC token for `audience`, or null when not running in GitHub
 * Actions with id-token permission (so the caller falls back to a `BRIKA_TOKEN`). Never
 * throws on a missing environment - only a present-but-failing request surfaces as null.
 */
export async function requestGithubOidcToken(audience: string): Promise<string | null> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !requestToken) return null;
  try {
    const res = await fetch(`${url}&audience=${encodeURIComponent(audience)}`, {
      headers: { authorization: `Bearer ${requestToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: string };
    return data.value ?? null;
  } catch {
    return null;
  }
}
