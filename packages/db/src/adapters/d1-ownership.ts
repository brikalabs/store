import {
  type OrgMembers,
  type OrgScopes,
  type OwnershipPolicy,
  type PublishIdentity,
  scopeOf,
  type TrustedPublishers,
  trustedPublisherMatches,
} from "@brika/registry-core";

/**
 * Publish authorization for the 1:N org model. A scope must be attached to an organisation,
 * then authorization splits by credential type:
 *
 * - **OIDC (CI) publish** (`identity.repository` set): allowed only when a TRUSTED PUBLISHER
 *   binding for the scope matches the token's repo + workflow (PUB-016, npm-style). Tokenless
 *   and not gated on membership - the binding IS the grant, so an org admin authorizes a
 *   specific repo/workflow without making the CI a member.
 * - **Token publish** (`identity.repository` null, a human `brika` CLI login): allowed when
 *   the identity is a MEMBER of the scope's owning org (any role).
 *
 * Anchored on the verified credential (OIDC `repository`/`workflow_ref` or the token subject),
 * so neither path can be spoofed. Resolves scope -> owning org (via {@link OrgScopes}); the
 * `org_id` also tells "unattached scope" apart from an authorization failure.
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #members: OrgMembers;
  readonly #scopes: OrgScopes;
  readonly #trusted: TrustedPublishers;

  constructor(members: OrgMembers, scopes: OrgScopes, trusted: TrustedPublishers) {
    this.#members = members;
    this.#scopes = scopes;
    this.#trusted = trusted;
  }

  async canPublish(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const scope = scopeOf(name);
    if (scope === null) {
      return { ok: false, message: "only scoped packages (@scope/name) can be published" };
    }

    const org = await this.#scopes.orgForScope(scope);
    if (org === null) {
      return {
        ok: false,
        message: `scope ${scope} is not attached to an organisation; claim it first`,
      };
    }

    // CI (OIDC) publish: authorized by a trusted-publisher binding, not membership.
    if (identity.repository !== null) {
      const bindings = await this.#trusted.listForScope(scope);
      if (bindings.some((b) => trustedPublisherMatches(b, identity))) return { ok: true };
      return {
        ok: false,
        message: `no trusted publisher for ${identity.repository} is configured for ${scope}; add one in the org console`,
      };
    }

    // Human token publish: org membership (any role).
    const member = { provider: identity.provider, id: identity.owner };
    if ((await this.#members.roleOf(org, member)) !== null) return { ok: true };
    return {
      ok: false,
      message: `you are not a member of organisation ${org} (owner of ${scope})`,
    };
  }
}
