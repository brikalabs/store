import { inject } from "@brika/di";
import {
  type OwnershipPolicy,
  type PublishIdentity,
  ScopeMembers,
  scopeOf,
  TrustedPublishers,
  trustedPublisherMatches,
} from "@brika/registry-core";

/**
 * Publish authorization for the scope-as-owner model. Splits by credential type, each anchored on
 * the verified credential so neither path can be spoofed (PUB-016):
 * - OIDC/CI (`identity.repository` set): a trusted-publisher binding for the scope must match the
 *   token's repo + workflow. Tokenless and not membership-gated - the binding IS the grant.
 * - Token (human `brika` account): `identity.userId` must be a member of the scope (any role).
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #members = inject(ScopeMembers);
  readonly #trusted = inject(TrustedPublishers);

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
