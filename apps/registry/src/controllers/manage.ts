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

/** Typed params + the request, shared by the management handlers. */
interface ManageContext {
  readonly params: PackageParams & { readonly version: string };
  readonly req: Request;
}

/**
 * Audit the outcome and turn it into the HTTP response: a rejection is audited as
 * `${action}_rejected` and thrown as its mapped status; success is audited and returned.
 */
async function auditAndRespond(
  action: string,
  name: string,
  version: string,
  identity: PublishIdentity,
  result: ManageResult,
  detail: Record<string, unknown>,
): Promise<Response> {
  await inject(Audit).record({
    action: result.ok ? action : `${action}_rejected`,
    packageName: name,
    version,
    actor: identity,
    detail: result.ok ? detail : { ...detail, status: result.status, message: result.message },
  });
  if (!result.ok) throw httpError(result.status, result.message);
  return reply({ ok: true, name, version, ...detail }, 200);
}

/** Authenticate the scope owner, run the mutation, and audit the outcome. */
async function runManaged(
  { params, req }: ManageContext,
  action: string,
  run: (svc: ManagementService, actor: PublishIdentity, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const name = packageName(params);
  const identity = await requireWrite(req);
  const result = await run(inject(ManagementService), identity, name);
  return auditAndRespond(action, name, params.version, identity, result, detail);
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

/** Like {@link runManaged}, but authenticates an ADMIN (not the scope owner) for an identity-free mutation. */
async function runAdmin(
  { params, req }: ManageContext,
  action: string,
  run: (svc: ManagementService, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const name = packageName(params);
  const identity = await requireAdmin(req);
  const result = await run(inject(ManagementService), name);
  return auditAndRespond(action, name, params.version, identity, result, detail);
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
