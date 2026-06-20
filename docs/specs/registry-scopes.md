# SCOPE , Scopes, membership & verified publisher

> How a Brika scope (`@acme`) is created, who belongs to it, and how it earns a
> verified publisher label. A scope is claimed by its creator (who becomes the
> first admin), governed JSR-style by its MEMBERS, and is the unit publishing is
> authorized against: only members of a package's scope may publish under it, and
> the scope's verified display name overrides the manifest `author` in the
> packument. The same domain (`ScopeService` over the `ScopeStore` + `ScopeMembers`
> ports) backs two surfaces over one shared D1 database: the registry HTTP API
> (`/-/scope/...`, token/OIDC auth) and the web console API (`/api/scopes/...`,
> session auth). The "a scope always keeps at least one admin" invariant is
> enforced atomically in SQL so concurrent demotions/removals cannot both pass.

Status legend and the code scheme live in [README](./README.md).

---

## SCOPE-001 , Claim a new scope (creator becomes first admin)

- **Status:** [DONE]
- **Area:** Scope lifecycle / claim
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.claim), `packages/db/src/adapters/d1-scope-store.ts` (D1ScopeStore.claim), `apps/registry/src/controllers/scope.ts` (createScope) - `packages/registry-core/src/scope.test.ts`

A scope must exist before anything publishes under it. The first caller to claim an
unclaimed scope owns it and is seeded as its first `admin`. The claim is race-safe:
the insert-if-absent is the serialization point, so a loser of a concurrent claim
reads back the winner's record. `PUT /-/scope/:scope` validates the scope is canonical
(`@` + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen).

**SCOPE-001-AC1** , Claiming an unclaimed scope creates it and returns 201
```gherkin
Given the scope @acme has no record in reg_scopes
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme
When the registry handles PUT /-/scope/@acme
Then the result is ok with created true and owner {provider: github, id: alice}
And a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the HTTP response status is 201
```

**SCOPE-001-AC2** , The creator is seeded as the scope's first admin
```gherkin
Given the scope @acme has no record in reg_scopes
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme
Then a reg_scope_members row exists with scope=@acme, provider=github, memberId=alice, role=admin
```

**SCOPE-001-AC3** , A non-canonical scope name is rejected before any write
```gherkin
Given the caller's verified identity is provider=github owner=alice
When the registry handles PUT /-/scope/Acme!
Then the HTTP response status is 400
And no reg_scopes row is created for that name
```

---

## SCOPE-002 , Re-claim a scope you already own (idempotent)

- **Status:** [DONE]
- **Area:** Scope lifecycle / claim
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.claim) - `packages/registry-core/src/scope.test.ts`

Claiming a scope you already own is a no-op success, so the operation is safe to retry.

**SCOPE-002-AC1** , Re-claiming an owned scope returns created false and 200
```gherkin
Given a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the caller's verified identity is provider=github owner=alice
When the caller claims @acme again
When the registry handles PUT /-/scope/@acme
Then the result is ok with created false and owner {provider: github, id: alice}
And the HTTP response status is 200
And no duplicate reg_scopes or reg_scope_members row is created
```

---

## SCOPE-003 , Claim a scope owned by another (conflict)

- **Status:** [DONE]
- **Area:** Scope lifecycle / claim
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.claim, ownedBy), `apps/registry/src/controllers/scope.ts` (scopeStatus) - `packages/registry-core/src/scope.test.ts`

A scope is owned by exactly one identity. A second identity cannot take it over.

**SCOPE-003-AC1** , Claiming a scope owned by someone else returns 409
```gherkin
Given a reg_scopes row exists with scope=@acme, ownerProvider=github, ownerId=alice
And the caller's verified identity is provider=github owner=bob
When the caller claims @acme
When the registry handles PUT /-/scope/@acme
Then the result is not ok with code conflict
And the HTTP response status is 409
And the existing reg_scopes owner is unchanged (ownerId=alice)
```

---

## SCOPE-004 , List members (member-gated)

- **Status:** [DONE]
- **Area:** Membership / read
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.listMembers, #requireMember), `packages/db/src/adapters/d1-scope-members.ts` (D1ScopeMembers.list) - `packages/registry-core/src/scope.test.ts`

Any member of a scope may view its members. A non-member is refused, and the refusal
distinguishes an unknown scope (404) from a real scope the caller has no membership in (403).

**SCOPE-004-AC1** , A member can list the scope's members
```gherkin
Given the scope @acme has members alice (admin) and bob (member)
And the caller's verified identity is provider=github owner=bob
When the caller lists members of @acme
When the registry handles GET /-/scope/@acme/members
Then the result is ok with members containing alice (admin) and bob (member)
And the HTTP response status is 200
```

**SCOPE-004-AC2** , A non-member of an existing scope is forbidden
```gherkin
Given the scope @acme exists with member alice (admin)
And the caller's verified identity is provider=github owner=carol who is not a member
When the caller lists members of @acme
Then the result is not ok with code forbidden
And the HTTP response status is 403
```

**SCOPE-004-AC3** , Listing members of an unknown scope is not found
```gherkin
Given no reg_scopes row exists for @ghost
And the caller's verified identity is provider=github owner=alice
When the caller lists members of @ghost
Then the result is not ok with code not_found
And the HTTP response status is 404
```

---

## SCOPE-005 , Add a member or change a role (admin only)

- **Status:** [DONE]
- **Area:** Membership / write
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.setMember, #requireAdmin), `packages/db/src/adapters/d1-scope-members.ts` (D1ScopeMembers.upsert) - `packages/registry-core/src/scope.test.ts`

Only an admin may add a member or change a member's role. `PUT /-/scope/:scope/member/:provider/:id`
carries the target role in the body (`{role: "admin" | "member"}`).

**SCOPE-005-AC1** , An admin can add a new member
```gherkin
Given the scope @acme has admin alice
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: dave} to role member
When the registry handles PUT /-/scope/@acme/member/github/dave with body {role: member}
Then the result is ok with member {provider: github, id: dave, role: member}
And a reg_scope_members row exists with scope=@acme, provider=github, memberId=dave, role=member
And the HTTP response status is 200
```

**SCOPE-005-AC2** , An admin can promote a member to admin
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: bob} to role admin
Then the result is ok with member {provider: github, id: bob, role: admin}
And the reg_scope_members row for bob has role=admin
```

**SCOPE-005-AC3** , A non-admin member cannot change membership
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=bob
When the caller sets member {provider: github, id: dave} to role member
Then the result is not ok with code forbidden
And the HTTP response status is 403
And no reg_scope_members row is created for dave
```

---

## SCOPE-006 , Cannot demote the last admin (conflict)

- **Status:** [DONE]
- **Area:** Membership / invariant
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.setMember), `packages/db/src/adapters/d1-scope-members.ts` (D1ScopeMembers.demoteFromAdmin, #moreThanOneAdmin) - `packages/registry-core/src/scope.test.ts`

A scope must always keep at least one admin. Demoting the last admin to member is refused
atomically: the "more than one admin" check is a subquery inside the UPDATE, so concurrent
demotions of different admins cannot both succeed.

**SCOPE-006-AC1** , Demoting the only admin is refused with conflict
```gherkin
Given the scope @acme has exactly one admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: alice} to role member
Then the result is not ok with code conflict
And the HTTP response status is 409
And the reg_scope_members row for alice still has role=admin
```

**SCOPE-006-AC2** , Demoting one of several admins succeeds
```gherkin
Given the scope @acme has two admins alice and bob
And the caller's verified identity is provider=github owner=alice
When the caller sets member {provider: github, id: bob} to role member
Then the result is ok with member {provider: github, id: bob, role: member}
And the reg_scope_members row for bob has role=member
And the reg_scope_members row for alice still has role=admin
```

---

## SCOPE-007 , Remove a member (admin only; 404 non-member)

- **Status:** [DONE]
- **Area:** Membership / write
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.removeMember), `packages/db/src/adapters/d1-scope-members.ts` (D1ScopeMembers.remove) - `packages/registry-core/src/scope.test.ts`

Only an admin may remove a member. Removing someone who is not a member of the scope
returns 404. `DELETE /-/scope/:scope/member/:provider/:id`.

**SCOPE-007-AC1** , An admin can remove a member
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: bob}
When the registry handles DELETE /-/scope/@acme/member/github/bob
Then the result is ok with removed {provider: github, id: bob}
And no reg_scope_members row exists for bob in @acme
And the HTTP response status is 200
```

**SCOPE-007-AC2** , Removing a non-member returns 404
```gherkin
Given the scope @acme has admin alice and no member named zoe
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: zoe}
Then the result is not ok with code not_found
And the HTTP response status is 404
```

**SCOPE-007-AC3** , A non-admin member cannot remove a member
```gherkin
Given the scope @acme has admin alice and members bob and dave
And the caller's verified identity is provider=github owner=bob
When the caller removes member {provider: github, id: dave}
Then the result is not ok with code forbidden
And the HTTP response status is 403
And the reg_scope_members row for dave still exists
```

---

## SCOPE-008 , Cannot remove the last admin (conflict)

- **Status:** [DONE]
- **Area:** Membership / invariant
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.removeMember), `packages/db/src/adapters/d1-scope-members.ts` (D1ScopeMembers.remove, #moreThanOneAdmin) - `packages/registry-core/src/scope.test.ts`

The last-admin invariant also guards removal: an admin who is the scope's only admin
cannot be removed. The guard is part of the DELETE statement (`role <> 'admin' or
moreThanOneAdmin`), so non-admins are always removable and only the last admin is protected.

**SCOPE-008-AC1** , Removing the only admin is refused with conflict
```gherkin
Given the scope @acme has exactly one admin alice and member bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: alice}
Then the result is not ok with code conflict
And the HTTP response status is 409
And the reg_scope_members row for alice still exists with role=admin
```

**SCOPE-008-AC2** , Removing one of several admins succeeds
```gherkin
Given the scope @acme has two admins alice and bob
And the caller's verified identity is provider=github owner=alice
When the caller removes member {provider: github, id: bob}
Then the result is ok with removed {provider: github, id: bob}
And no reg_scope_members row exists for bob
And the reg_scope_members row for alice still has role=admin
```

---

## SCOPE-009 , Set the verified publisher display name (admin only, validated)

- **Status:** [DONE]
- **Area:** Verified publisher / label
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/scope.ts` (ScopeService.setDisplayName), `packages/registry-core/src/labels.ts` (displayNameSchema, hasUnsafeLabelChars), `apps/registry/src/controllers/scope.ts` (setDisplayName, DisplayNameBody) - `packages/registry-core/src/labels.test.ts`

The display name is the publisher label users are told to trust over the manifest
`author`, so only an admin may set it and its value is validated by the shared
`displayNameSchema`: 1-120 chars, normalized to NFC, rejecting invisible / control /
format / spoofing characters. A null value clears the label. `POST /-/scope/:scope/display-name`.

**SCOPE-009-AC1** , An admin can set the display name
```gherkin
Given the scope @acme has admin alice and no display name
And the caller's verified identity is provider=github owner=alice
When the caller sets the display name to "Acme Corporation"
When the registry handles POST /-/scope/@acme/display-name with body {displayName: "Acme Corporation"}
Then the result is ok with displayName "Acme Corporation"
And the reg_scopes row for @acme has displayName="Acme Corporation"
And the HTTP response status is 200
```

**SCOPE-009-AC2** , A display name with invisible or control characters is rejected
```gherkin
Given the caller's verified identity is provider=github owner=alice who is an admin of @acme
When the caller submits a display name containing a zero-width or control character
Then displayNameSchema validation fails
And the HTTP response status is 400
And the reg_scopes displayName is unchanged
```

**SCOPE-009-AC3** , A display name outside 1-120 chars is rejected
```gherkin
Given the caller is an admin of @acme
When the caller submits an empty display name or one longer than 120 characters
Then displayNameSchema validation fails
And the HTTP response status is 400
```

**SCOPE-009-AC4** , A non-admin cannot set the display name
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=bob
When the caller sets the display name to "Acme"
Then the result is not ok with code forbidden
And the HTTP response status is 403
And the reg_scopes displayName is unchanged
```

**SCOPE-009-AC5** , Passing null clears the display name
```gherkin
Given the scope @acme has admin alice and displayName="Acme Corporation"
And the caller's verified identity is provider=github owner=alice
When the caller sets the display name to null
Then the result is ok with displayName null
And the reg_scopes row for @acme has displayName null
```

---

## SCOPE-010 , Display name overrides the manifest author in the packument

- **Status:** [DONE]
- **Area:** Verified publisher / packument
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/d1-metadata.ts` (D1MetadataReader.getPackage, publisher), `packages/registry-core/src/packument.ts` (buildPackument) - `packages/registry-core/src/scope.test.ts`

When a package's scope has a verified display name, the packument surfaces it as the
trusted `publisher` (name + verified: true), overriding whatever the manifest `author`
claims. When the scope has no display name the publisher name falls back to the scope owner's id.

**SCOPE-010-AC1** , The packument publisher uses the scope's verified display name
```gherkin
Given the scope @acme has ownerId=alice and displayName="Acme Corporation"
And a package @acme/widget exists whose manifest author is "Someone Else"
When the packument for @acme/widget is built
Then the packument publisher.name is "Acme Corporation"
And the packument publisher.verified is true
```

**SCOPE-010-AC2** , Without a display name the publisher falls back to the owner id
```gherkin
Given the scope @acme has ownerId=alice and displayName null
And a package @acme/widget exists
When the packument for @acme/widget is built
Then the packument publisher.name is "alice"
And the packument publisher.verified is true
```

---

## SCOPE-011 , Ownership policy gates publish by scope membership

- **Status:** [DONE]
- **Area:** Ownership / publish authorization
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/d1-ownership.ts` (D1OwnershipPolicy.canPublish) - `packages/db/src/adapters/d1-ownership.test.ts`

Publishing is authorized against the package's scope: only a member of that scope (any
role) may publish under it, anchored on the verified credential. The policy never claims a
scope implicitly, and distinguishes an unknown scope (create it first) from a real scope
the caller has no membership in.

**SCOPE-011-AC1** , A member of the scope may publish under it
```gherkin
Given the scope @acme has member bob
And the caller's verified identity is provider=github owner=bob
When canPublish is checked for @acme/widget
Then the result is ok true
```

**SCOPE-011-AC2** , A non-member of an existing scope may not publish
```gherkin
Given the scope @acme exists and the caller is not a member
And the caller's verified identity is provider=github owner=carol
When canPublish is checked for @acme/widget
Then the result is ok false
And the message states the caller is not a member of @acme
```

**SCOPE-011-AC3** , Publishing under an unknown scope is refused (create it first)
```gherkin
Given no reg_scopes row exists for @ghost
And the caller's verified identity is provider=github owner=alice
When canPublish is checked for @ghost/widget
Then the result is ok false
And the message states scope @ghost does not exist; create it first
And no reg_scopes row is created for @ghost
```

**SCOPE-011-AC4** , An unscoped package name cannot be published
```gherkin
Given the caller's verified identity is provider=github owner=alice
When canPublish is checked for the unscoped name "widget"
Then the result is ok false
And the message states only scoped packages (@scope/name) can be published
```

---

## SCOPE-012 , List the scopes I belong to (console read)

- **Status:** [DONE]
- **Area:** Membership / read model
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/queries.ts` (listScopesForMember), `apps/web/src/routes/api.scopes.ts` (GET) - `packages/db/src/adapters/queries.test.ts`

The console lists the scopes the signed-in user is a member of, each with their role and
the scope's verified display name, sorted by scope name. This is a plain read model, not an
authorization-bearing use case.

**SCOPE-012-AC1** , The read returns every scope the member belongs to, with role
```gherkin
Given github user alice is admin of @acme and member of @beta
And github user alice is not a member of @gamma
When listScopesForMember(db, github, alice) is called
When the console handles GET /api/scopes
Then the result contains @acme with role admin and @beta with role member
And it does not contain @gamma
And the entries are sorted by scope name
```

**SCOPE-012-AC2** , Each entry carries the scope's verified display name
```gherkin
Given @acme has displayName="Acme Corporation" and alice is a member
When listScopesForMember(db, github, alice) is called
Then the @acme entry has displayName "Acme Corporation"
```

---

## SCOPE-013 , Console session surface enforces the same scope rules

- **Status:** [DONE]
- **Area:** Console API / parity
- **Test mode:** manual
- **Traceability:** `apps/web/src/routes/api.scopes.$scope.ts` (claim), `apps/web/src/routes/api.scopes.$scope.members.ts` (list/set), `apps/web/src/routes/api.scopes.$scope.members.$memberId.ts` (remove), `apps/web/src/routes/api.scopes.$scope.display-name.ts` (display name) - manual (verified in-browser: claim @maxtest created as admin; members + display-name pages work)

The web console API (session auth, identity = sessionIdentity(user) = {provider: github,
owner: login}) reuses the SAME `ScopeService` over the same shared D1 as the registry HTTP
surface, so claim, membership, last-admin, and display-name rules and result codes are
identical across both surfaces. Domain result codes map the same way: forbidden -> 403,
not_found -> 404, conflict -> 409.

**SCOPE-013-AC1** , The console claims a scope and makes the user its admin
```gherkin
Given a signed-in console user whose github login is maxtest
When the console handles PUT /api/scopes/@maxtest
Then the response status is 201 with created true
And a reg_scope_members row exists with scope=@maxtest, provider=github, memberId=maxtest, role=admin
```

**SCOPE-013-AC2** , The console enforces the last-admin invariant identically
```gherkin
Given the console user is the only admin of @maxtest
When the console handles PUT /api/scopes/@maxtest/members demoting themselves to member
Then the response status is 409
And their reg_scope_members role stays admin
```

**SCOPE-013-AC3** , The console applies the shared display-name validation
```gherkin
Given the console user is an admin of @maxtest
When the console handles POST /api/scopes/@maxtest/display-name with a name carrying invisible characters
Then the response status is 400
And the reg_scopes displayName is unchanged
```

**SCOPE-013-AC4** , Console membership writes are admin-gated like the registry
```gherkin
Given the console user is a non-admin member of @maxtest
When the console handles PUT /api/scopes/@maxtest/members or DELETE /api/scopes/@maxtest/members/:memberId
Then the response status is 403
```
