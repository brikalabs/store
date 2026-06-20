import {
  type OrgMembers,
  type OrgScopes,
  type OwnershipPolicy,
  type PublishIdentity,
  scopeOf,
} from "@brika/registry-core";

/**
 * Membership-based publish authorization (1:N org model): a scope must be attached to an
 * organisation (see the org controller), and only MEMBERS of that org may publish under
 * it (any role; admins also manage the org). Publishing never claims a scope or org
 * implicitly. Anchored on the verified credential (OIDC `repository_owner` or a publish
 * token), so it cannot be spoofed. Resolves scope -> owning org (via {@link OrgScopes})
 * -> membership (via {@link OrgMembers}); the scope's `org_id` also tells "unattached
 * scope" apart from "not a member of the owning org".
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #members: OrgMembers;
  readonly #scopes: OrgScopes;

  constructor(members: OrgMembers, scopes: OrgScopes) {
    this.#members = members;
    this.#scopes = scopes;
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

    const member = { provider: identity.provider, id: identity.owner };
    if ((await this.#members.roleOf(org, member)) !== null) return { ok: true };
    return {
      ok: false,
      message: `you are not a member of organisation ${org} (owner of ${scope})`,
    };
  }
}
