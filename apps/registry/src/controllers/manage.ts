import { inject } from "@brika/di";
import { ManagementService, type ManageResult, type PublishIdentity } from "@brika/registry-core";
import { httpError, reply } from "@brika/router";
import { type PackageParams, PKG, packageName } from "@brika/router/npm";
import { z } from "zod";
import { requireAdmin, requireWrite } from "../auth";
import { controller, route } from "../http/router";
import { Audit } from "../services";

/**
 * Post-publish management endpoints. All mutate only the version's flags; the immutable
 * tarball bytes never change.
 *
 * Owner-gated (scope ownership):  deprecate, yank
 * Operator-admin-gated (`REGISTRY_ADMINS`, NOT scope ownership):  takedown, restore
 */

const DeprecateBody = z.object({ message: z.string().max(1024).nullable() });
const YankBody = z.object({ yanked: z.boolean() });
const TakedownBody = z.object({ reason: z.string().min(1).max(1024) });

/** A management mutation: authenticate the actor, run it, audit the outcome, and serialize it. The
 *  `auth` seam is the only difference between an owner-gated and an operator-admin-gated action; a
 *  package-wide action omits `version` (it is not version-specific). */
async function manage(
  params: PackageParams & { readonly version?: string },
  req: Request,
  action: string,
  auth: (req: Request) => Promise<PublishIdentity>,
  run: (svc: ManagementService, actor: PublishIdentity, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const name = packageName(params);
  const version = params.version ?? null;
  const identity = await auth(req);
  const result = await run(inject(ManagementService), identity, name);
  await inject(Audit).record({
    action: result.ok ? action : `${action}_rejected`,
    packageName: name,
    version,
    actor: identity,
    detail: result.ok ? detail : { ...detail, status: result.status, message: result.message },
  });
  if (!result.ok) throw httpError(result.status, result.message);
  return reply({ ok: true, name, ...(version === null ? {} : { version }), ...detail }, 200);
}

/** Typed params (with `:version`) + the request, shared by the version-scoped handlers. */
interface ManageContext {
  readonly params: PackageParams & { readonly version: string };
  readonly req: Request;
}

export function deprecate(
  input: ManageContext & { readonly body: z.infer<typeof DeprecateBody> },
): Promise<Response> {
  const { params, body } = input;
  return manage(params, input.req, "deprecate", requireWrite, (svc, actor, name) =>
    svc.deprecate(actor, name, params.version, body.message), { deprecated: body.message });
}

export function yank(
  input: ManageContext & { readonly body: z.infer<typeof YankBody> },
): Promise<Response> {
  const { params, body } = input;
  return manage(params, input.req, "yank", requireWrite, (svc, actor, name) =>
    svc.setYanked(actor, name, params.version, body.yanked), { yanked: body.yanked });
}

export function takedown(
  input: ManageContext & { readonly body: z.infer<typeof TakedownBody> },
): Promise<Response> {
  const { params, body } = input;
  return manage(params, input.req, "takedown", requireAdmin, (svc, _actor, name) =>
    svc.takedown(name, params.version, body.reason), { takedown: body.reason });
}

export function restore(input: ManageContext): Promise<Response> {
  const { params } = input;
  return manage(params, input.req, "restore", requireAdmin, (svc, _actor, name) =>
    svc.restore(name, params.version), { takedown: null });
}

/** Operator takedown of a WHOLE package (every version, current and future). */
export function takedownPackage(
  input: { readonly params: PackageParams; readonly req: Request; readonly body: z.infer<typeof TakedownBody> },
): Promise<Response> {
  return manage(input.params, input.req, "package_takedown", requireAdmin, (svc, _actor, name) =>
    svc.takedownPackage(name, input.body.reason), { takedown: input.body.reason });
}

/** Reverse a whole-package takedown. */
export function restorePackage(
  input: { readonly params: PackageParams; readonly req: Request },
): Promise<Response> {
  return manage(input.params, input.req, "package_restore", requireAdmin, (svc, _actor, name) =>
    svc.restorePackage(name), { takedown: null });
}

export const manageController = controller({
  name: "manage",
  prefix: "/-/package",
  routes: [
    route.post({ path: `/${PKG}/:version/deprecate`, body: DeprecateBody, handler: deprecate }),
    route.post({ path: `/${PKG}/:version/yank`, body: YankBody, handler: yank }),
    route.post({ path: `/${PKG}/:version/takedown`, body: TakedownBody, handler: takedown }),
    route.post({ path: `/${PKG}/:version/restore`, handler: restore }),
    route.post({ path: `/${PKG}/takedown`, body: TakedownBody, handler: takedownPackage }),
    route.post({ path: `/${PKG}/restore`, handler: restorePackage }),
  ],
});
