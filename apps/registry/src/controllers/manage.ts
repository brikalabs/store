import type {
  ManageErrorCode,
  ManagementService,
  ManageResult,
  PublishIdentity,
} from "@brika/registry-core";
import { httpError, reply } from "@brika/router";
import { type PackageParams, PKG, packageName } from "@brika/router/npm";
import { z } from "zod";
import { requireAdmin, requireWrite } from "../auth";
import { controller, route } from "../http/router";
import type { Services } from "../services";

/**
 * Post-publish management endpoints. The `PKG` pattern matches scoped and unscoped
 * names, so each route is declared once; {@link packageName} joins the matched
 * params into the full name. All mutate only the version's flags; the immutable
 * tarball bytes never change.
 *
 * Owner-gated (OIDC or a registry token, gated by scope ownership):
 *   POST /-/package/:name/:version/deprecate   body `{ message: string | null }`
 *   POST /-/package/:name/:version/yank        body `{ yanked: boolean }`
 *
 * Operator-admin-gated (`REGISTRY_ADMINS`, NOT scope ownership):
 *   POST /-/package/:name/:version/takedown    body `{ reason: string }`
 *   POST /-/package/:name/:version/restore
 */

const DeprecateBody = z.object({ message: z.string().max(1024).nullable() });
const YankBody = z.object({ yanked: z.boolean() });
const TakedownBody = z.object({ reason: z.string().min(1).max(1024) });

function statusForManageError(code: ManageErrorCode): number {
  return code === "forbidden" ? 403 : 404;
}

/** What both management handlers need: typed params + the request + the service graph. */
interface ManageContext {
  readonly params: PackageParams & { readonly version: string };
  readonly req: Request;
  readonly ctx: Services;
}

/**
 * Audit the outcome and turn it into the HTTP response, shared by the owner- and
 * admin-gated runners: a rejection is audited as `${action}_rejected` and thrown as its
 * mapped status; success is audited and returned. The auth + which service call to run
 * is all that differs between the two runners.
 */
async function auditAndRespond(
  ctx: ManageContext["ctx"],
  action: string,
  name: string,
  version: string,
  identity: PublishIdentity,
  result: ManageResult,
  detail: Record<string, unknown>,
): Promise<Response> {
  await ctx.audit.record({
    action: result.ok ? action : `${action}_rejected`,
    packageName: name,
    version,
    actor: identity,
    detail: result.ok ? detail : { ...detail, code: result.code, message: result.message },
  });
  if (!result.ok) throw httpError(statusForManageError(result.code), result.message, result.code);
  return reply({ ok: true, name, version, ...detail }, 200);
}

/** Authenticate the scope owner, run the mutation, and audit the outcome. */
async function runManaged(
  { params, req, ctx }: ManageContext,
  action: string,
  run: (svc: ManagementService, actor: PublishIdentity, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const name = packageName(params);
  const identity = await requireWrite(req, ctx.tokens);
  const result = await run(ctx.management, identity, name);
  return auditAndRespond(ctx, action, name, params.version, identity, result, detail);
}

export function deprecate(
  input: ManageContext & { readonly body: z.infer<typeof DeprecateBody> },
): Promise<Response> {
  const { params, body } = input;
  return runManaged(
    input,
    "deprecate",
    (svc, actor, name) => svc.deprecate(actor, name, params.version, body.message),
    { deprecated: body.message },
  );
}

export function yank(
  input: ManageContext & { readonly body: z.infer<typeof YankBody> },
): Promise<Response> {
  const { params, body } = input;
  return runManaged(
    input,
    "yank",
    (svc, actor, name) => svc.setYanked(actor, name, params.version, body.yanked),
    { yanked: body.yanked },
  );
}

/**
 * Like {@link runManaged}, but for operator actions: authenticate an ADMIN (not the
 * scope owner) and run an identity-free mutation. Admin failures surface as 403 from
 * `requireAdmin` before this runs; the only domain failure here is `not_found`.
 */
async function runAdmin(
  { params, req, ctx }: ManageContext,
  action: string,
  run: (svc: ManagementService, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const name = packageName(params);
  const identity = await requireAdmin(req, ctx.tokens, ctx.admins);
  const result = await run(ctx.management, name);
  return auditAndRespond(ctx, action, name, params.version, identity, result, detail);
}

export function takedown(
  input: ManageContext & { readonly body: z.infer<typeof TakedownBody> },
): Promise<Response> {
  const { params, body } = input;
  return runAdmin(
    input,
    "takedown",
    (svc, name) => svc.takedown(name, params.version, body.reason),
    {
      takedown: body.reason,
    },
  );
}

export function restore(input: ManageContext): Promise<Response> {
  const { params } = input;
  return runAdmin(input, "restore", (svc, name) => svc.restore(name, params.version), {
    takedown: null,
  });
}

export const manageController = controller({
  name: "manage",
  prefix: "/-/package",
  routes: [
    route.post({ path: `/${PKG}/:version/deprecate`, body: DeprecateBody, handler: deprecate }),
    route.post({ path: `/${PKG}/:version/yank`, body: YankBody, handler: yank }),
    route.post({ path: `/${PKG}/:version/takedown`, body: TakedownBody, handler: takedown }),
    route.post({ path: `/${PKG}/:version/restore`, handler: restore }),
  ],
});
