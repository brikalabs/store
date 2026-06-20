import { z } from "zod";

/**
 * OIDC verification for tokenless ("trusted") publishing. The signature + time +
 * issuer + audience checks are provider-neutral ({@link verifyOidc}); each provider
 * (GitHub today, GitLab/Google later) only differs in its claim shape and how those
 * map to a publish identity. {@link verifyGithubOidc} is the GitHub-configured
 * wrapper. Pure Web Crypto, JWKS injected for testing.
 */

export const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const GITLAB_ISSUER = "https://gitlab.com";

/** Claims every OIDC issuer carries; provider-specific claims ride alongside (loose). */
export const BaseClaims = z
  .object({
    iss: z.string(),
    aud: z.string(),
    sub: z.string(),
    exp: z.number(),
    nbf: z.number().optional(),
    iat: z.number().optional(),
  })
  .loose();
export type BaseClaims = z.infer<typeof BaseClaims>;

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

/**
 * GitLab CI ID-token claims (gitlab.com). `project_path` is `group/project` (the GitHub
 * `repository` analog); `ci_config_ref_uri` points at the pipeline's config file (the
 * `workflow_ref` analog, e.g. `gitlab.com/group/project//.gitlab-ci.yml@refs/heads/main`).
 */
export const GitlabClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string(),
  project_path: z.string(),
  namespace_path: z.string().optional(),
  ci_config_ref_uri: z.string().optional(),
  ref: z.string().optional(),
  sha: z.string().optional(),
  pipeline_id: z.string().optional(),
  exp: z.number(),
  nbf: z.number().optional(),
  iat: z.number().optional(),
});
export type GitlabClaims = z.infer<typeof GitlabClaims>;

/**
 * A CI publish identity normalized across OIDC providers, so the registry's authorization +
 * trusted-publisher matching are provider-neutral. `repository` + `workflowRef` are what a
 * trusted-publisher binding matches; `provider` qualifies the binding.
 */
export interface OidcIdentity {
  readonly provider: string;
  /** Owner/namespace (GitHub `repository_owner`, GitLab `namespace_path`). */
  readonly owner: string;
  /** Project (GitHub `owner/repo`, GitLab `group/project`). */
  readonly repository: string;
  readonly workflowRef?: string;
  readonly ref?: string;
  readonly sha?: string;
  readonly runId?: string;
}

/** Map verified GitHub claims to the normalized identity. */
export function githubIdentity(claims: OidcClaims): OidcIdentity {
  return {
    provider: "github",
    owner: claims.repository_owner,
    repository: claims.repository,
    workflowRef: claims.workflow_ref,
    ref: claims.ref,
    sha: claims.sha,
    runId: claims.run_id,
  };
}

/** Map verified GitLab claims to the normalized identity. */
export function gitlabIdentity(claims: GitlabClaims): OidcIdentity {
  return {
    provider: "gitlab",
    owner: claims.namespace_path ?? claims.project_path.split("/")[0] ?? claims.project_path,
    repository: claims.project_path,
    workflowRef: claims.ci_config_ref_uri,
    ref: claims.ref,
    sha: claims.sha,
    runId: claims.pipeline_id,
  };
}

/** Read a token's UNVERIFIED issuer, to pick which provider should verify it. Null if malformed. */
export function peekIssuer(token: string): string | null {
  const payloadPart = token.split(".")[1];
  if (payloadPart === undefined) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
    return typeof claims?.iss === "string" ? claims.iss : null;
  } catch {
    return null;
  }
}

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
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.codePointAt(i) ?? 0;
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
 * Provider-neutral OIDC verification: checks the RS256 signature against the JWKS,
 * then the issuer, audience and time window. Returns the raw claims bag (a provider
 * then narrows it to its own schema), or null on any failure. The trust anchor that
 * every provider's verifier builds on.
 */
export async function verifyOidc(
  token: string,
  jwks: JwksProvider,
  options: Required<Pick<VerifyOidcOptions, "issuer" | "audience">> & { now?: number },
): Promise<BaseClaims | null> {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (headerPart === undefined || payloadPart === undefined || signaturePart === undefined) {
    return null;
  }

  const header = parseJson(JwtHeader, new TextDecoder().decode(base64UrlToBytes(headerPart)));
  if (header?.alg !== "RS256") return null;

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

  const claims = parseJson(BaseClaims, new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  if (claims === null) return null;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (claims.iss !== options.issuer) return null;
  if (claims.aud !== options.audience) return null;
  if (claims.exp <= now) return null;
  if (claims.nbf !== undefined && claims.nbf > now) return null;

  return claims;
}

/**
 * Verify a GitHub Actions OIDC token: the generic {@link verifyOidc} checks, then
 * the GitHub claim shape (`repository` / `repository_owner`). Returns the GitHub
 * claims when everything checks out; otherwise null.
 */
export async function verifyGithubOidc(
  token: string,
  jwks: JwksProvider,
  options: VerifyOidcOptions,
): Promise<OidcClaims | null> {
  const claims = await verifyOidc(token, jwks, {
    issuer: options.issuer ?? GITHUB_ISSUER,
    audience: options.audience,
    now: options.now,
  });
  if (claims === null) return null;
  const github = OidcClaims.safeParse(claims);
  return github.success ? github.data : null;
}

/**
 * Verify a GitLab CI OIDC ID token (gitlab.com): the generic {@link verifyOidc} checks, then
 * the GitLab claim shape (`project_path`). Returns the GitLab claims, else null.
 */
export async function verifyGitlabOidc(
  token: string,
  jwks: JwksProvider,
  options: VerifyOidcOptions,
): Promise<GitlabClaims | null> {
  const claims = await verifyOidc(token, jwks, {
    issuer: options.issuer ?? GITLAB_ISSUER,
    audience: options.audience,
    now: options.now,
  });
  if (claims === null) return null;
  const gitlab = GitlabClaims.safeParse(claims);
  return gitlab.success ? gitlab.data : null;
}
