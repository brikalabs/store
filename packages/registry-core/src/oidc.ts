import { z } from "zod";

/**
 * GitHub Actions OIDC verification, the tokenless-publish trust anchor. A
 * `brika-publish` workflow requests an OIDC token (`id-token: write`) bound to a
 * specific audience; the registry verifies the RS256 signature against GitHub's
 * JWKS and the claims, then trusts the `repository` / `repository_owner` it
 * carries to authorize the publish. Pure Web Crypto, JWKS injected for testing.
 */

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";

export const OidcClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string(),
  /** `owner/repo` that ran the workflow. */
  repository: z.string(),
  /** `owner` of the workflow repository. */
  repository_owner: z.string(),
  ref: z.string().optional(),
  sha: z.string().optional(),
  actor: z.string().optional(),
  workflow_ref: z.string().optional(),
  /** Numeric id of the workflow run, for a build-summary link. */
  run_id: z.string().optional(),
  exp: z.number(),
  nbf: z.number().optional(),
  iat: z.number().optional(),
});
export type OidcClaims = z.infer<typeof OidcClaims>;

const JwtHeader = z.object({ alg: z.string(), kid: z.string() });

export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

/** Supplies GitHub's signing keys (injected so the verifier is testable). */
export interface JwksProvider {
  keys(): Promise<Jwk[]>;
}

export interface VerifyOidcOptions {
  /** The audience our publish endpoint requires (prevents token reuse). */
  audience: string;
  /** Issuer to require; defaults to GitHub Actions. */
  issuer?: string;
  /** Current time in seconds; defaults to now. */
  now?: number;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Copy into a fresh ArrayBuffer-backed view for the Web Crypto signature. */
function freshView(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const view = new Uint8Array(data.byteLength);
  view.set(data);
  return view;
}

function parseJson<T>(schema: z.ZodType<T>, raw: string): T | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Verify a GitHub Actions OIDC token. Returns the claims when the signature,
 * issuer, audience and time window all check out; otherwise null.
 */
export async function verifyGithubOidc(
  token: string,
  jwks: JwksProvider,
  options: VerifyOidcOptions,
): Promise<OidcClaims | null> {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (headerPart === undefined || payloadPart === undefined || signaturePart === undefined) {
    return null;
  }

  const header = parseJson(JwtHeader, new TextDecoder().decode(base64UrlToBytes(headerPart)));
  if (header === null || header.alg !== "RS256") return null;

  const jwk = (await jwks.keys()).find((key) => key.kid === header.kid);
  if (jwk === undefined) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signed = freshView(new TextEncoder().encode(`${headerPart}.${payloadPart}`));
  const signature = freshView(base64UrlToBytes(signaturePart));
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
  if (!valid) return null;

  const claims = parseJson(OidcClaims, new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  if (claims === null) return null;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (claims.iss !== (options.issuer ?? GITHUB_ISSUER)) return null;
  if (claims.aud !== options.audience) return null;
  if (claims.exp <= now) return null;
  if (claims.nbf !== undefined && claims.nbf > now) return null;

  return claims;
}
