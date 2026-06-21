import { inject } from "@brika/di";
import {
  auditEntry,
  displayNameSchema,
  domainChallengeHost,
  isCanonicalScope,
  type PublishIdentity,
  ScopeService,
  scopeDomainSchema,
  scopeProfileSchema,
  trustedPublisherSchema,
} from "@brika/registry-core";
import { badRequest, httpError, okOrThrow, rateLimit, reply } from "@brika/router";
import { z } from "zod";
import { cf } from "../adapters/cf-rate-limiter";
import { principal, requireAdmin, requireWrite } from "../auth";
import { controller, route } from "../http/router";
import { Audit } from "../services";

/**
 * Scope management HTTP layer. The scope is the first-class ownership entity (npm/JSR model,
 * no org layer); publishing under a scope is gated on its MEMBERS:
 *
 *   PUT    /-/scope/:scope                          claim a scope (caller becomes admin)
 *   GET    /-/scope/:scope                          public scope info (unauthenticated)
 *   GET    /-/scope/:scope/members                  list members (any member)
 *   PUT    /-/scope/:scope/member/:userId           add or re-role a member (admin)
 *   DELETE /-/scope/:scope/member/:userId           remove a member (admin)
 *   POST   /-/scope/:scope/display-name             set the publisher label (admin)
 *   PUT    /-/scope/:scope/profile                  set the description + links (admin)
 *   GET    /-/scope/:scope/domains                  list claimed domains (any member)
 *   PUT    /-/scope/:scope/domain/:domain           claim a domain (admin)
 *   POST   /-/scope/:scope/domain/:domain/verify    verify a domain (admin)
 *   DELETE /-/scope/:scope/domain/:domain           drop a domain (admin)
 *   GET    /-/scope/:scope/trusted-publishers       list trusted-publisher bindings (admin)
 *   PUT    /-/scope/:scope/trusted-publishers        authorize a repo+workflow (admin)
 *   DELETE /-/scope/:scope/trusted-publishers        revoke a binding (admin)
 *
 * Plus two operator-admin-gated routes (the `REGISTRY_ADMINS` allowlist, NOT scope membership):
 *
 *   POST   /-/scope/:scope/takedown                 withdraw a squatted scope from listings (ORG-007)
 *   POST   /-/scope/:scope/restore                  reverse a takedown (ORG-007)
 *
 * These handlers are thin: they validate input, resolve the caller's verified identity,
 * delegate the rules + invariants to `inject(ScopeService)` (the domain service), audit the
 * outcome, and map the result to a status. No database access or business logic here.
 */

/** Record a scope audit entry. Every scope action shares packageName=scope, version=null, and the
 *  caller as actor, varying only by action + detail. */
function auditScope(
  action: string,
  scope: string,
  actor: PublishIdentity,
  detail: Record<string, unknown> | null = null,
): Promise<void> {
  return inject(Audit).record(auditEntry(actor, { action, packageName: scope, detail }));
}

/**
 * `GET /-/scope/:scope` - public scope info (scope, display name, description, links, icon
 * key, verified domains) or 404. Pending domains + membership are never exposed.
 */
export async function getScope({
  params,
}: {
  readonly params: { readonly scope: string };
}): Promise<Response> {
  const scopes = inject(ScopeService);
  const info = await scopes.getPublic(params.scope);
  if (info === null) throw httpError(404, `scope ${params.scope} does not exist`, "not_found");
  const { hasIcon: _hasIcon, ...rest } = info;
  const iconKey = await scopes.iconKeyOf(params.scope);
  return reply({ ok: true, ...rest, iconKey }, 200);
}

/** `PUT /-/scope/:scope` - claim a scope (201 created, 200 already yours, 409 taken, 429 capped). */
export async function createScope({
  params,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  if (!isCanonicalScope(scope)) {
    throw badRequest(
      "scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
    );
  }
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).claim(identity, scope));
  if (result.created) {
    await auditScope("scope_create", scope, identity);
  }
  return reply({ ok: true, scope, created: result.created }, result.created ? 201 : 200);
}

/** `GET /-/scope/:scope/members` - list the scope's members (any member). */
export async function listMembers({
  params,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).listMembers(identity, scope));
  return reply({ ok: true, scope, members: result.members }, 200);
}

const MemberBody = z.object({ role: z.enum(["admin", "member"]) });

/** `PUT /-/scope/:scope/member/:userId` - add or re-role a member by account id (admin). */
export async function putMember({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string; readonly userId: string };
  readonly body: z.infer<typeof MemberBody>;
  readonly req: Request;
}): Promise<Response> {
  const { scope, userId } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(
    await inject(ScopeService).setMember(identity, scope, userId, body.role),
  );
  await auditScope("scope_member_set", scope, identity, { userId, role: body.role });
  return reply({ ok: true, scope, member: result.member }, 200);
}

/** `DELETE /-/scope/:scope/member/:userId` - remove a member by account id (admin). */
export async function deleteMember({
  params,
  req,
}: {
  readonly params: { readonly scope: string; readonly userId: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope, userId } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).removeMember(identity, scope, userId));
  await auditScope("scope_member_remove", scope, identity, { userId });
  return reply({ ok: true, scope, removed: result.removed }, 200);
}

// The publisher label is the name users are told to trust over the manifest `author`, so
// its validation (length + no spoofing/invisible chars + NFC) lives in `@brika/registry-core`
// `displayNameSchema` and is shared with the store console, defined once.
const DisplayNameBody = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /-/scope/:scope/display-name` - set the verified publisher label (admin). */
export async function setDisplayName({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof DisplayNameBody>;
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  okOrThrow(await inject(ScopeService).setDisplayName(identity, scope, body.displayName));
  await auditScope("scope_display_name", scope, identity, { displayName: body.displayName });
  return reply({ ok: true, scope, displayName: body.displayName }, 200);
}

/** `PUT /-/scope/:scope/profile` - set the description + links (admin; ORG-009). */
export async function setProfile({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof scopeProfileSchema>;
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(
    await inject(ScopeService).setProfile(identity, scope, {
      description: body.description,
      links: body.links,
    }),
  );
  await auditScope("scope_profile_set", scope, identity, { links: body.links.length });
  return reply({ ok: true, scope, profile: result.profile }, 200);
}

/** `GET /-/scope/:scope/domains` - list claimed domains, verified + pending (any member; ORG-010). */
export async function listDomains({
  params,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const scopes = inject(ScopeService);
  const identity = await requireWrite(req);
  const result = okOrThrow(await scopes.listDomains(identity, scope));
  const domains = await Promise.all(
    result.domains.map(async (d) => ({
      ...d,
      host: domainChallengeHost(d.domain),
      txt: await scopes.domainChallenge(scope, d.domain),
    })),
  );
  return reply({ ok: true, scope, domains }, 200);
}

/** Validate + normalize a `:domain` path param (lowercased) or 400. */
function parseDomain(raw: string): string {
  const parsed = scopeDomainSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) throw badRequest("not a valid domain name");
  return parsed.data;
}

/** `PUT /-/scope/:scope/domain/:domain` - claim a domain; returns its TXT challenge (admin; ORG-010). */
export async function addDomain({
  params,
  req,
}: {
  readonly params: { readonly scope: string; readonly domain: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const domain = parseDomain(params.domain);
  const scopes = inject(ScopeService);
  const identity = await requireWrite(req);
  const result = okOrThrow(await scopes.addDomain(identity, scope, domain));
  await auditScope("scope_domain_add", scope, identity, { domain });
  return reply(
    {
      ok: true,
      scope,
      domain: result.domain,
      host: domainChallengeHost(domain),
      txt: await scopes.domainChallenge(scope, domain),
    },
    201,
  );
}

/** `POST /-/scope/:scope/domain/:domain/verify` - check DNS for the challenge (admin; ORG-010). */
export async function verifyDomain({
  params,
  req,
}: {
  readonly params: { readonly scope: string; readonly domain: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const domain = parseDomain(params.domain);
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).verifyDomain(identity, scope, domain));
  if (result.verified) {
    await auditScope("scope_domain_verified", scope, identity, { domain });
  }
  return reply({ ok: true, scope, domain, verified: result.verified }, 200);
}

/** `DELETE /-/scope/:scope/domain/:domain` - drop a claimed domain (admin; ORG-010). */
export async function deleteDomain({
  params,
  req,
}: {
  readonly params: { readonly scope: string; readonly domain: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const domain = parseDomain(params.domain);
  const identity = await requireWrite(req);
  okOrThrow(await inject(ScopeService).removeDomain(identity, scope, domain));
  await auditScope("scope_domain_remove", scope, identity, { domain });
  return reply({ ok: true, scope, removed: domain }, 200);
}

/** `GET /-/scope/:scope/trusted-publishers` - list bindings (admin; PUB-016). */
export async function listTrustedPublishers({
  params,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).listTrustedPublishers(identity, scope));
  return reply({ ok: true, scope, publishers: result.publishers }, 200);
}

/** `PUT /-/scope/:scope/trusted-publishers` - authorize a repo+workflow (admin; PUB-016). */
export async function addTrustedPublisher({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof trustedPublisherSchema>;
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(await inject(ScopeService).addTrustedPublisher(identity, scope, body));
  await auditScope("scope_trusted_publisher_add", scope, identity, { ...body });
  return reply({ ok: true, scope, publisher: result.publisher }, 201);
}

/** `DELETE /-/scope/:scope/trusted-publishers` - revoke a binding (admin; PUB-016). */
export async function removeTrustedPublisher({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof trustedPublisherSchema>;
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req);
  const result = okOrThrow(
    await inject(ScopeService).removeTrustedPublisher(identity, scope, body),
  );
  await auditScope("scope_trusted_publisher_remove", scope, identity, { ...body });
  return reply({ ok: true, scope, removed: result.removed }, 200);
}

const TakedownBody = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /-/scope/:scope/takedown` - operator withdraws a squatted/abusive scope from public
 * listings (ORG-007-AC1). Gated on the registry-operator allowlist via {@link requireAdmin}
 * (NOT scope membership), so a non-operator gets 403 (ORG-007-AC2). The reason is audited.
 */
export async function takedownScope({
  params,
  body,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof TakedownBody>;
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireAdmin(req);
  okOrThrow(await inject(ScopeService).takedown(scope, body.reason));
  await auditScope("scope_takedown", scope, identity, { reason: body.reason });
  return reply({ ok: true, scope, takedown: body.reason }, 200);
}

/** `POST /-/scope/:scope/restore` - operator reverses a takedown (admin only; ORG-007). */
export async function restoreScope({
  params,
  req,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireAdmin(req);
  okOrThrow(await inject(ScopeService).restore(scope));
  await auditScope("scope_restore", scope, identity);
  return reply({ ok: true, scope, takedown: null }, 200);
}

export const scopeController = controller({
  name: "scope",
  prefix: "/-/scope",
  routes: [
    // Claiming a scope is rate-limited by authenticated principal so a script cannot mass-claim
    // names (ORG-004); the per-account cap in ScopeService is the hard ceiling, this blunts
    // bursts. The claim shares the `CLAIM_LIMITER` window.
    route.put({
      path: "/:scope",
      middleware: [
        rateLimit({ max: 10, window: "1m", key: principal, store: cf("CLAIM_LIMITER") }),
      ],
      handler: createScope,
    }),
    // Public, unauthenticated scope info for the storefront's `/scope/:scope` page (ORG-003).
    route.get({ path: "/:scope", handler: getScope }),
    route.get({ path: "/:scope/members", handler: listMembers }),
    route.put({ path: "/:scope/member/:userId", body: MemberBody, handler: putMember }),
    route.delete({ path: "/:scope/member/:userId", handler: deleteMember }),
    route.post({ path: "/:scope/display-name", body: DisplayNameBody, handler: setDisplayName }),
    route.put({ path: "/:scope/profile", body: scopeProfileSchema, handler: setProfile }),
    route.get({ path: "/:scope/domains", handler: listDomains }),
    route.put({ path: "/:scope/domain/:domain", handler: addDomain }),
    route.post({ path: "/:scope/domain/:domain/verify", handler: verifyDomain }),
    route.delete({ path: "/:scope/domain/:domain", handler: deleteDomain }),
    // Trusted publishers for a scope (PUB-016): the bindings that authorize tokenless OIDC
    // (CI) publishes. Admin-gated to the scope's members.
    route.get({ path: "/:scope/trusted-publishers", handler: listTrustedPublishers }),
    route.put({
      path: "/:scope/trusted-publishers",
      body: trustedPublisherSchema,
      handler: addTrustedPublisher,
    }),
    route.delete({
      path: "/:scope/trusted-publishers",
      body: trustedPublisherSchema,
      handler: removeTrustedPublisher,
    }),
    // Operator-only (REGISTRY_ADMINS), not scope membership: takedown/restore a squatted scope.
    route.post({ path: "/:scope/takedown", body: TakedownBody, handler: takedownScope }),
    route.post({ path: "/:scope/restore", handler: restoreScope }),
  ],
});
