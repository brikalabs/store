import type {
  ManageErrorCode,
  ManagementService,
  ManageResult,
  PublishIdentity,
} from "@brika/registry-core";
import { httpError, reply } from "@brika/router";
import { type PackageParams, PKG, packageName } from "@brika/router/npm";
import { z } from "zod";
import { requireWrite } from "../auth";
import { controller, route } from "../http/router";
import type { Services } from "../services";

/**
 * Post-publish management endpoints, authenticated like publish (OIDC or a
 * registry token) and gated by scope ownership in `ManagementService`:
 *
 *   POST /-/package/:name/:version/deprecate   body `{ message: string | null }`
 *   POST /-/package/:name/:version/yank        body `{ yanked: boolean }`
 *
 * Both mutate only the version's flags; the immutable tarball bytes never change.
 * The `PKG` pattern matches scoped and unscoped names, so each route is declared
 * once; {@link packageName} joins the matched params into the full name.
 */

const DeprecateBody = z.object({ message: z.string().max(1024).nullable() });
const YankBody = z.object({ yanked: z.boolean() });

function statusForManageError(code: ManageErrorCode): number {
  return code === "forbidden" ? 403 : 404;
}

/** What both management handlers need: typed params + the request + the service graph. */
interface ManageContext {
  readonly params: PackageParams & { readonly version: string };
  readonly req: Request;
  readonly ctx: Services;
}

/** Authenticate, run the mutation, and audit the outcome. */
async function runManaged(
  { params, req, ctx }: ManageContext,
  action: string,
  run: (svc: ManagementService, actor: PublishIdentity, name: string) => Promise<ManageResult>,
  detail: Record<string, unknown>,
): Promise<Response> {
  const { db, management, audit } = ctx;
  const name = packageName(params);
  const identity = await requireWrite(req, db);

  const result = await run(management, identity, name);

  await audit.record({
    action: result.ok ? action : `${action}_rejected`,
    packageName: name,
    version: params.version,
    actor: identity,
    detail: result.ok ? detail : { ...detail, code: result.code, message: result.message },
  });

  if (!result.ok) throw httpError(statusForManageError(result.code), result.message, result.code);
  return reply({ ok: true, name, version: params.version, ...detail }, 200);
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

export const manageController = controller({
  name: "manage",
  prefix: "/-/package",
  routes: [
    route.post({ path: `/${PKG}/:version/deprecate`, body: DeprecateBody, handler: deprecate }),
    route.post({ path: `/${PKG}/:version/yank`, body: YankBody, handler: yank }),
  ],
});
