import { env } from "cloudflare:workers";
import { type PublishErrorCode, PublishService } from "@brika/registry-core";
import { getDb, regAudit } from "@brika/store-db";
import { z } from "zod";
import { D1MetadataWriter } from "./adapters/d1-metadata-writer";
import { D1OwnershipPolicy } from "./adapters/d1-ownership";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";
import { authenticateWrite } from "./auth";

/**
 * `POST /-/publish`. Authenticated by EITHER a GitHub Actions OIDC token (CI,
 * audience `brika-registry`) OR a registry publish token (local `brika publish`).
 * Body: `{ name, version, manifest, tarball }` (tarball base64). All publish
 * logic + invariants live in `PublishService`; this is the wiring.
 */

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

export async function handlePublish(request: Request): Promise<Response> {
  const db = getDb(env.DB);
  const identity = await authenticateWrite(request, db);
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
