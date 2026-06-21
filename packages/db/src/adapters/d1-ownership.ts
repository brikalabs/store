import {
  type OwnershipPolicy,
  type PublishIdentity,
  type ScopeMembers,
  scopeOf,
  type TrustedPublishers,
  trustedPublisherMatches,
} from "@brika/registry-core";

/**
 * Publish authorization for the scope-as-owner model (the scope IS the account; no org
 * layer). The scope must exist (have at least one member), then authorization splits by
 * credential type:
 *
 * - **OIDC (CI) publish** (`identity.repository` set): allowed only when a TRUSTED PUBLISHER
 *   binding for the scope matches the token's repo + workflow (PUB-016, npm-style). Tokenless
 *   and not gated on membership - the binding IS the grant, so a scope admin authorizes a
 *   specific repo/workflow without making the CI a member.
 * - **Token publish** (`identity.repository` null, a human `brika` CLI account): allowed when
 *   the account (`identity.userId`) is a MEMBER of the scope (any role).
 *
 * Anchored on the verified credential (OIDC `repository`/`workflow_ref` or the token's account),
 * so neither path can be spoofed. Membership is resolved directly against the scope (via
 * {@link ScopeMembers}); "unclaimed scope" is told apart from an authorization failure by the
 * absence of any member.
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #members: ScopeMembers;
  readonly #trusted: TrustedPublishers;

  constructor(members: ScopeMembers, trusted: TrustedPublishers) {
    this.#members = members;
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

    // CI (OIDC) publish: authorized by a trusted-publisher binding, not membership.
    if (identity.repository !== null) {
      const bindings = await this.#trusted.listForScope(scope);
      if (bindings.some((b) => trustedPublisherMatches(b, identity))) return { ok: true };
      return {
        ok: false,
        message: `no trusted publisher for ${identity.repository} is configured for ${scope}; add one in the scope console`,
      };
    }

    // Human token publish: scope membership (any role).
    if (identity.userId !== null && (await this.#members.roleOf(scope, identity.userId)) !== null) {
      return { ok: true };
    }
    return {
      ok: false,
      message: `you are not a member of scope ${scope}`,
    };
  }
}
