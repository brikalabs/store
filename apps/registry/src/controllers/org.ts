import {
  displayNameSchema,
  domainChallengeHost,
  isCanonicalOrgSlug,
  isCanonicalScope,
  orgDescriptionSchema,
  orgDomainSchema,
  orgLinksSchema,
} from "@brika/registry-core";
import { badRequest, httpError, rateLimit, reply } from "@brika/router";
import { z } from "zod";
import { cf } from "../adapters/cf-rate-limiter";
import { principal, requireAdmin, requireWrite } from "../auth";
import { okOrThrow } from "../http/result";
import { controller, route } from "../http/router";

import type { Services } from "../services";

/**
 * Organisation management HTTP layer. An org is the first-class ownership entity (it owns
 * one or more npm scopes); publishing under any scope it owns is gated on org MEMBERS:
 *
 *   PUT    /-/org/:org                          claim an org (caller becomes admin)
 *   GET    /-/org/:org/members                  list members (any member)
 *   PUT    /-/org/:org/member/:provider/:id     add or re-role a member (admin)
 *   DELETE /-/org/:org/member/:provider/:id     remove a member (admin)
 *   POST   /-/org/:org/display-name             set the publisher label (admin)
 *   GET    /-/org/:org/scopes                   list the scopes the org owns (any member)
 *   PUT    /-/org/:org/scope/:scope             attach a scope to the org (admin)
 *
 * Plus two operator-admin-gated routes (the `REGISTRY_ADMINS` allowlist, NOT org membership):
 *
 *   POST   /-/org/:org/takedown                 withdraw a squatted org from listings (ORG-007)
 *   POST   /-/org/:org/restore                  reverse a takedown (ORG-007)
 *
 * These handlers are thin: they validate input, resolve the caller's verified identity,
 * delegate the rules + invariants to `ctx.orgs` (the domain `OrgService`), audit the
 * outcome, and map the result to a status. No database access or business logic here.
 */

/**
 * `GET /-/org/:org` - public org info (slug, display name, description, links, icon key,
 * owned scopes, verified domains) or 404. Pending domains + membership are never exposed.
 */
export async function getOrg({
  params,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly ctx: Services;
}): Promise<Response> {
  const info = await ctx.orgs.getPublic(params.org);
  if (info === null) throw httpError(404, `organisation ${params.org} does not exist`, "not_found");
  return reply({ ok: true, ...info }, 200);
}

/** `PUT /-/org/:org` - claim an org (201 created, 200 already yours, 409 taken, 429 capped). */
export async function createOrg({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  if (!isCanonicalOrgSlug(org)) {
    throw badRequest(
      "org slug must be 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
    );
  }
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.claim(identity, org));
  if (result.created) {
    await ctx.audit.record({
      action: "org_create",
      packageName: org,
      version: null,
      actor: identity,
      detail: null,
    });
  }
  return reply({ ok: true, org, created: result.created }, result.created ? 201 : 200);
}

/** `GET /-/org/:org/members` - list the org's members (any member). */
export async function listMembers({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.listMembers(identity, org));
  return reply({ ok: true, org, members: result.members }, 200);
}

const MemberBody = z.object({ role: z.enum(["admin", "member"]) });

/** `PUT /-/org/:org/member/:provider/:id` - add or re-role a member (admin). */
export async function putMember({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly provider: string; readonly id: string };
  readonly body: z.infer<typeof MemberBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, provider, id } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.setMember(identity, org, { provider, id }, body.role));
  await ctx.audit.record({
    action: "org_member_set",
    packageName: org,
    version: null,
    actor: identity,
    detail: { provider, id, role: body.role },
  });
  return reply({ ok: true, org, member: result.member }, 200);
}

/** `DELETE /-/org/:org/member/:provider/:id` - remove a member (admin). */
export async function deleteMember({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly provider: string; readonly id: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, provider, id } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.removeMember(identity, org, { provider, id }));
  await ctx.audit.record({
    action: "org_member_remove",
    packageName: org,
    version: null,
    actor: identity,
    detail: { provider, id },
  });
  return reply({ ok: true, org, removed: result.removed }, 200);
}

// The publisher label is the name users are told to trust over the manifest `author`, so
// its validation (length + no spoofing/invisible chars + NFC) lives in `@brika/registry-core`
// `displayNameSchema` and is shared with the store console, defined once.
const DisplayNameBody = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /-/org/:org/display-name` - set the verified publisher label (admin). */
export async function setDisplayName({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly body: z.infer<typeof DisplayNameBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireWrite(req, ctx.tokens);
  okOrThrow(await ctx.orgs.setDisplayName(identity, org, body.displayName));
  await ctx.audit.record({
    action: "org_display_name",
    packageName: org,
    version: null,
    actor: identity,
    detail: { displayName: body.displayName },
  });
  return reply({ ok: true, org, displayName: body.displayName }, 200);
}

const ProfileBody = z.object({
  description: orgDescriptionSchema.nullable(),
  links: orgLinksSchema,
});

/** `PUT /-/org/:org/profile` - set the description + links (admin; ORG-009). */
export async function setProfile({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly body: z.infer<typeof ProfileBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(
    await ctx.orgs.setProfile(identity, org, {
      description: body.description,
      links: body.links,
    }),
  );
  await ctx.audit.record({
    action: "org_profile_set",
    packageName: org,
    version: null,
    actor: identity,
    detail: { links: body.links.length },
  });
  return reply({ ok: true, org, profile: result.profile }, 200);
}

/** `GET /-/org/:org/domains` - list claimed domains, verified + pending (any member; ORG-010). */
export async function listDomains({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.listDomains(identity, org));
  const domains = await Promise.all(
    result.domains.map(async (d) => ({
      ...d,
      host: domainChallengeHost(d.domain),
      txt: await ctx.orgs.domainChallenge(org, d.domain),
    })),
  );
  return reply({ ok: true, org, domains }, 200);
}

/** Validate + normalize a `:domain` path param (lowercased) or 400. */
function parseDomain(raw: string): string {
  const parsed = orgDomainSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) throw badRequest("not a valid domain name");
  return parsed.data;
}

/** `PUT /-/org/:org/domain/:domain` - claim a domain; returns its TXT challenge (admin; ORG-010). */
export async function addDomain({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly domain: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const domain = parseDomain(params.domain);
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.addDomain(identity, org, domain));
  await ctx.audit.record({
    action: "org_domain_add",
    packageName: org,
    version: null,
    actor: identity,
    detail: { domain },
  });
  return reply(
    {
      ok: true,
      org,
      domain: result.domain,
      host: domainChallengeHost(domain),
      txt: await ctx.orgs.domainChallenge(org, domain),
    },
    201,
  );
}

/** `POST /-/org/:org/domain/:domain/verify` - check DNS for the challenge (admin; ORG-010). */
export async function verifyDomain({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly domain: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const domain = parseDomain(params.domain);
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.verifyDomain(identity, org, domain));
  if (result.verified) {
    await ctx.audit.record({
      action: "org_domain_verified",
      packageName: org,
      version: null,
      actor: identity,
      detail: { domain },
    });
  }
  return reply({ ok: true, org, domain, verified: result.verified }, 200);
}

/** `DELETE /-/org/:org/domain/:domain` - drop a claimed domain (admin; ORG-010). */
export async function deleteDomain({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly domain: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const domain = parseDomain(params.domain);
  const identity = await requireWrite(req, ctx.tokens);
  okOrThrow(await ctx.orgs.removeDomain(identity, org, domain));
  await ctx.audit.record({
    action: "org_domain_remove",
    packageName: org,
    version: null,
    actor: identity,
    detail: { domain },
  });
  return reply({ ok: true, org, removed: domain }, 200);
}

/** `GET /-/org/:org/scopes` - list the scopes the org owns (any member; ORG-008-AC1). */
export async function listScopes({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.listScopes(identity, org));
  return reply({ ok: true, org, scopes: result.scopes }, 200);
}

/** `PUT /-/org/:org/scope/:scope` - attach a scope to the org (admin; ORG-008-AC2/AC3). */
export async function attachScope({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly scope: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, scope } = params;
  if (!isCanonicalScope(scope)) {
    throw badRequest(
      "scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
    );
  }
  const identity = await requireWrite(req, ctx.tokens);
  okOrThrow(await ctx.orgs.attachScope(identity, org, scope));
  await ctx.audit.record({
    action: "org_scope_attach",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { org },
  });
  return reply({ ok: true, org, scope }, 201);
}

// A trusted-publisher binding (PUB-016): provider + project + the workflow/config filename
// allowed to publish under the scope via OIDC. Validated here so a malformed binding never
// reaches the store (and so it can actually match a real OIDC ref claim).
const TrustedPublisherBody = z.object({
  provider: z.enum(["github", "gitlab"]),
  repository: z.string().regex(/^[^\s/]+(?:\/[^\s/]+)+$/, "repository must be 'owner/repo'"),
  workflow: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/, "workflow must be a workflow filename, e.g. publish.yml"),
});

/** `GET /-/org/:org/scope/:scope/trusted-publishers` - list bindings (admin; PUB-016). */
export async function listTrustedPublishers({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly scope: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, scope } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.listTrustedPublishers(identity, org, scope));
  return reply({ ok: true, org, scope, publishers: result.publishers }, 200);
}

/** `PUT /-/org/:org/scope/:scope/trusted-publishers` - authorize a repo+workflow (admin; PUB-016). */
export async function addTrustedPublisher({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly scope: string };
  readonly body: z.infer<typeof TrustedPublisherBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, scope } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.addTrustedPublisher(identity, org, scope, body));
  await ctx.audit.record({
    action: "org_trusted_publisher_add",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { org, ...body },
  });
  return reply({ ok: true, org, scope, publisher: result.publisher }, 201);
}

/** `DELETE /-/org/:org/scope/:scope/trusted-publishers` - revoke a binding (admin; PUB-016). */
export async function removeTrustedPublisher({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string; readonly scope: string };
  readonly body: z.infer<typeof TrustedPublisherBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org, scope } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = okOrThrow(await ctx.orgs.removeTrustedPublisher(identity, org, scope, body));
  await ctx.audit.record({
    action: "org_trusted_publisher_remove",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { org, ...body },
  });
  return reply({ ok: true, org, scope, removed: result.removed }, 200);
}

const TakedownBody = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /-/org/:org/takedown` - operator withdraws a squatted/abusive org from public
 * listings (ORG-007-AC1). Gated on the registry-operator allowlist via {@link requireAdmin}
 * (NOT org membership), so a non-operator gets 403 (ORG-007-AC2). The reason is audited.
 */
export async function takedownOrg({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly body: z.infer<typeof TakedownBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireAdmin(req, ctx.tokens, ctx.admins);
  okOrThrow(await ctx.orgs.takedown(org, body.reason));
  await ctx.audit.record({
    action: "org_takedown",
    packageName: org,
    version: null,
    actor: identity,
    detail: { reason: body.reason },
  });
  return reply({ ok: true, org, takedown: body.reason }, 200);
}

/** `POST /-/org/:org/restore` - operator reverses a takedown (admin only; ORG-007). */
export async function restoreOrg({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly org: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { org } = params;
  const identity = await requireAdmin(req, ctx.tokens, ctx.admins);
  okOrThrow(await ctx.orgs.restore(org));
  await ctx.audit.record({
    action: "org_restore",
    packageName: org,
    version: null,
    actor: identity,
    detail: null,
  });
  return reply({ ok: true, org, takedown: null }, 200);
}

export const orgController = controller({
  name: "org",
  prefix: "/-/org",
  routes: [
    // Claiming an org or attaching a scope is rate-limited by authenticated principal so a
    // script cannot mass-claim names (ORG-004); the per-account cap in OrgService is the
    // hard ceiling, this blunts bursts. Both share the `CLAIM_LIMITER` window.
    route.put({
      path: "/:org",
      middleware: [
        rateLimit({ max: 10, window: "1m", key: principal, store: cf("CLAIM_LIMITER") }),
      ],
      handler: createOrg,
    }),
    // Public, unauthenticated org info for the storefront's `/org/:org` page (ORG-003).
    route.get({ path: "/:org", handler: getOrg }),
    route.get({ path: "/:org/members", handler: listMembers }),
    route.put({ path: "/:org/member/:provider/:id", body: MemberBody, handler: putMember }),
    route.delete({ path: "/:org/member/:provider/:id", handler: deleteMember }),
    route.post({ path: "/:org/display-name", body: DisplayNameBody, handler: setDisplayName }),
    route.put({ path: "/:org/profile", body: ProfileBody, handler: setProfile }),
    route.get({ path: "/:org/domains", handler: listDomains }),
    route.put({ path: "/:org/domain/:domain", handler: addDomain }),
    route.post({ path: "/:org/domain/:domain/verify", handler: verifyDomain }),
    route.delete({ path: "/:org/domain/:domain", handler: deleteDomain }),
    route.get({ path: "/:org/scopes", handler: listScopes }),
    route.put({
      path: "/:org/scope/:scope",
      middleware: [
        rateLimit({ max: 10, window: "1m", key: principal, store: cf("CLAIM_LIMITER") }),
      ],
      handler: attachScope,
    }),
    // Trusted publishers for a scope (PUB-016): the bindings that authorize tokenless OIDC
    // (CI) publishes. Admin-gated to the scope's owning org.
    route.get({ path: "/:org/scope/:scope/trusted-publishers", handler: listTrustedPublishers }),
    route.put({
      path: "/:org/scope/:scope/trusted-publishers",
      body: TrustedPublisherBody,
      handler: addTrustedPublisher,
    }),
    route.delete({
      path: "/:org/scope/:scope/trusted-publishers",
      body: TrustedPublisherBody,
      handler: removeTrustedPublisher,
    }),
    // Operator-only (REGISTRY_ADMINS), not org membership: takedown/restore a squatted org.
    route.post({ path: "/:org/takedown", body: TakedownBody, handler: takedownOrg }),
    route.post({ path: "/:org/restore", handler: restoreOrg }),
  ],
});
