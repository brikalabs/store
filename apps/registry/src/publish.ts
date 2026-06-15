import { env } from "cloudflare:workers";
import {
  type PublishErrorCode,
  type PublishIdentity,
  PublishService,
  verifyGithubOidc,
} from "@brika/registry-core";
import { type Db, getDb, regAudit } from "@brika/store-db";
import { z } from "zod";
import { D1MetadataWriter } from "./adapters/d1-metadata-writer";
import { D1OwnershipPolicy } from "./adapters/d1-ownership";
import { GithubJwksProvider } from "./adapters/github-jwks";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";
import { verifyToken } from "./adapters/token";

/**
 * `POST /-/publish`. Authenticated by EITHER a GitHub Actions OIDC token (CI,
 * audience `brika-registry`) OR a registry publish token (local `brika publish`).
 * Body: `{ name, version, manifest, tarball }` (tarball base64). All publish
 * logic + invariants live in `PublishService`; this is the wiring.
 */

const AUDIENCE = "brika-registry";
const jwks = new GithubJwksProvider();

const PublishBody = z.object({
  name: z.string(),
  version: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  tarball: z.string(),
});

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function reply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Map a publish rejection code to its HTTP status. */
function statusForPublishError(code: PublishErrorCode): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "exists":
      return 409;
    case "too_large":
      return 413;
    default:
      return 400;
  }
}

/** OIDC (CI) first, then a publish token (local). Returns the publish identity. */
async function authenticate(request: Request, db: Db): Promise<PublishIdentity | null> {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);

  const claims = await verifyGithubOidc(token, jwks, { audience: AUDIENCE });
  if (claims !== null) return { owner: claims.repository_owner, repository: claims.repository };

  const tokenUser = await verifyToken(db, token);
  if (tokenUser !== null) return { owner: tokenUser.githubLogin, repository: null };

  return null;
}

export async function handlePublish(request: Request): Promise<Response> {
  const db = getDb(env.DB);
  const identity = await authenticate(request, db);
  if (identity === null) return reply({ error: "Unauthorized" }, 401);

  const raw: unknown = await request.json().catch(() => null);
  const parsed = PublishBody.safeParse(raw);
  if (!parsed.success) return reply({ error: "Invalid publish body" }, 400);
  const { name, version, manifest, tarball } = parsed.data;

  if (manifest.name !== name || manifest.version !== version) {
    return reply({ error: "Manifest name/version must match the published name/version" }, 400);
  }

  const service = new PublishService(
    new D1MetadataWriter(db),
    new R2TarballWriter(env.TARBALLS),
    new SchemaManifestValidator(),
    new D1OwnershipPolicy(db),
  );
  const result = await service.publish({
    name,
    version,
    tarball: base64ToBytes(tarball),
    manifest,
    identity,
  });

  await db.insert(regAudit).values({
    id: crypto.randomUUID(),
    action: result.ok ? "publish" : "publish_rejected",
    packageName: name,
    version,
    actor: identity.repository ?? identity.owner,
    detail: result.ok ? null : { code: result.code, message: result.message },
  });

  if (!result.ok) {
    const status = statusForPublishError(result.code);
    return reply({ error: result.message, code: result.code }, status);
  }
  return reply({ ok: true, name, version, integrity: result.integrity }, 201);
}
