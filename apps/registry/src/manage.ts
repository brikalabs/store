import { env } from "cloudflare:workers";
import { type ManageErrorCode, ManagementService, type ManageResult } from "@brika/registry-core";
import { getDb, regAudit } from "@brika/store-db";
import { z } from "zod";
import { D1MetadataWriter } from "./adapters/d1-metadata-writer";
import { D1OwnershipPolicy } from "./adapters/d1-ownership";
import { authenticateWrite } from "./auth";

/**
 * Post-publish management endpoints, authenticated like publish (OIDC or a
 * registry token) and gated by scope ownership in `ManagementService`:
 *
 *   POST /-/package/:name/:version/deprecate   body `{ message: string | null }`
 *   POST /-/package/:name/:version/yank        body `{ yanked: boolean }`
 *
 * Both mutate only the version's flags; the immutable tarball bytes never change.
 */

const DeprecateBody = z.object({ message: z.string().max(1024).nullable() });
const YankBody = z.object({ yanked: z.boolean() });

function reply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function statusForManageError(code: ManageErrorCode): number {
  return code === "forbidden" ? 403 : 404;
}

function service(): ManagementService {
  const db = getDb(env.DB);
  return new ManagementService(new D1MetadataWriter(db), new D1OwnershipPolicy(db));
}

/** Authenticate, run the mutation, and audit the outcome. */
async function handle(
  request: Request,
  name: string,
  version: string,
  action: string,
  run: (
    svc: ManagementService,
    actor: { owner: string; repository: string | null },
  ) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const db = getDb(env.DB);
  const identity = await authenticateWrite(request, db);
  if (identity === null) return reply({ error: "Unauthorized" }, 401);

  const result = await run(service(), identity);

  await db.insert(regAudit).values({
    id: crypto.randomUUID(),
    action: result.ok ? action : `${action}_rejected`,
    packageName: name,
    version,
    actor: identity.repository ?? identity.owner,
    detail: result.ok ? detail : { ...detail, code: result.code, message: result.message },
  });

  if (!result.ok)
    return reply({ error: result.message, code: result.code }, statusForManageError(result.code));
  return reply({ ok: true, name, version, ...detail }, 200);
}

export async function handleDeprecate(
  request: Request,
  name: string,
  version: string,
): Promise<Response> {
  const parsed = DeprecateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Invalid deprecate body" }, 400);
  const { message } = parsed.data;
  return handle(
    request,
    name,
    version,
    "deprecate",
    (svc, actor) => svc.deprecate(actor, name, version, message),
    { deprecated: message },
  );
}

export async function handleYank(
  request: Request,
  name: string,
  version: string,
): Promise<Response> {
  const parsed = YankBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Invalid yank body" }, 400);
  const { yanked } = parsed.data;
  return handle(
    request,
    name,
    version,
    "yank",
    (svc, actor) => svc.setYanked(actor, name, version, yanked),
    { yanked },
  );
}
