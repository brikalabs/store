# ORG , Organisations & anti-squatting

> The organisation ("org") is the first-class ownership entity that owns an npm
> **scope** (its `@name` namespace). This area covers renaming today's "scope"
> entity to "org", the public org page, and the policy that stops name squatting.
> Design rationale and decisions: [../org-model-design.md](../org-model-design.md).
> The currently-implemented ownership behaviour is specified as `SCOPE-*` and will
> be retired to `[GONE]` when these land (codes are append-only).

Status legend and the code scheme live in [README](./README.md).

---

## ORG-001 , Organisation is the ownership entity (rename of "scope")

- **Status:** [TODO]
- **Area:** Org / model
- **Test mode:** none
- **Traceability:** , (not yet built; see org-model-design.md migration sketch)

The membership/ownership entity is named **organisation** across domain, storage,
registry management API, and console. The word "scope" is retained ONLY for the
npm namespace string an org owns (resolve/publish/packument/`isCanonicalScope`),
which is npm protocol.

**ORG-001-AC1** , org owns a scope
```gherkin
Given an organisation "brika"
When I read its record
Then it owns the npm scope "@brika"
And packages published under "@brika" are governed by org "brika" membership
```

**ORG-001-AC2** , npm read surface is unchanged by the rename
```gherkin
Given the rename has shipped
When a client runs "bun add @brika/plugin-x"
Then the packument and tarball resolve exactly as before
And no client-visible npm path changed from "scope" to "org"
```

**ORG-001-AC3** , management API moves to /-/org
```gherkin
Given the rename has shipped
When an authenticated client manages an org
Then it uses "/-/org/:org" endpoints
And the prior "SCOPE-*" ownership behaviour is preserved under the new names
```

---

## ORG-002 , An org owns one or more scopes (1:N)

- **Status:** [TODO]
- **Area:** Org / model
- **Test mode:** none
- **Traceability:** , (not yet built; reg_orgs + reg_org_members + reg_scopes.orgId)

An organisation is a distinct entity with its own slug that can own multiple npm
scopes. Membership lives on the org; a scope belongs to exactly one org.

**ORG-002-AC1** , create an org
```gherkin
Given I am authenticated
When I create organisation "acme"
Then the org exists with me as its admin
And its public page lives at "/org/acme"
```

**ORG-002-AC2** , an org owns multiple scopes
```gherkin
Given I admin organisation "acme"
When I attach scope "@acme" and scope "@acme-labs" to it
Then both scopes are owned by org "acme"
And org membership governs publishing to both
```

**ORG-002-AC3** , a scope belongs to exactly one org
```gherkin
Given scope "@acme" is owned by org "acme"
When anyone attempts to attach "@acme" to a different org
Then it is refused (a scope cannot belong to two orgs)
```

---

## ORG-003 , Public organisation page

- **Status:** [TODO]
- **Area:** Org / storefront
- **Test mode:** none
- **Traceability:** , (not yet built; reuses the catalog read path filtered by scope)

A public SSR page at `store.brika.dev/org/:org` listing the org's published
plugins aggregated across all of its scopes, with its verified display name.

**ORG-003-AC1** , lists the org's public plugins across all its scopes
```gherkin
Given org "acme" owns scopes "@acme" and "@acme-labs" with published plugins
When I visit "/org/acme"
Then I see the org's verified display name
And I see plugins from both "@acme" and "@acme-labs" in one list
```

**ORG-003-AC2** , hides withdrawn versions
```gherkin
Given a plugin in the org has only yanked or taken-down versions
When I visit the org page
Then that plugin is not listed (consistent with the catalog rules)
```

**ORG-003-AC3** , unknown org
```gherkin
Given no org "nope" exists
When I visit "/org/nope"
Then I get a 404 page
```

---

## ORG-004 , Claim rate limit

- **Status:** [TODO]
- **Area:** Org / abuse
- **Test mode:** none
- **Traceability:** , (not yet built; reuse @brika/router rateLimit + cf() like HARDEN-001)

Throttle org/scope claims per authenticated principal so a script cannot mass-claim.

**ORG-004-AC1** , claims are throttled per principal
```gherkin
Given I am authenticated as principal P
And I have made the maximum allowed claims this window
When I attempt another claim
Then I get 429 with a Retry-After header
And no new org is created
```

---

## ORG-005 , Per-account org cap

- **Status:** [TODO]
- **Area:** Org / abuse
- **Test mode:** none
- **Traceability:** , (not yet built; count check in the claim use case)

A soft cap on how many orgs one account may hold, raisable on request.

**ORG-005-AC1** , cap blocks further claims
```gherkin
Given my account already holds the maximum number of orgs
When I attempt to claim another
Then the claim is refused with a clear "limit reached" message
And no new org is created
```

**ORG-005-AC2** , cap is raisable
```gherkin
Given an operator raises my org limit
When I claim another org within the new limit
Then the claim succeeds
```

---

## ORG-006 , Identity-tied claiming (GitHub-verified)

- **Status:** [TODO]
- **Area:** Org / abuse
- **Test mode:** none
- **Traceability:** , (not yet built; mirrors the GitHub-OIDC trust used by publish)

You may only claim an org/scope whose name matches a GitHub identity you provably
control: your own login, or a GitHub org where you are an admin.

**ORG-006-AC1** , claim a name you control
```gherkin
Given I am the GitHub user "alice"
When I claim org "alice"
Then the claim succeeds
```

**ORG-006-AC2** , claim a GitHub org you admin
```gherkin
Given I am an admin of the GitHub organisation "acme"
When I claim org "acme"
Then the claim succeeds
```

**ORG-006-AC3** , cannot claim a name you do not control
```gherkin
Given I am the GitHub user "alice"
And I am not associated with "microsoft"
When I claim org "microsoft"
Then the claim is refused as not verifiably mine
And no new org is created
```

---

## ORG-007 , Operator takedown of a squatted org

- **Status:** [TODO]
- **Area:** Org / abuse
- **Test mode:** none
- **Traceability:** , (not yet built; extend the version takedown/restore to orgs)

An operator (admin allowlist) can take down and restore an org name, as a backstop
for squats that slip through.

**ORG-007-AC1** , operator takes down a squatted org
```gherkin
Given an org name is being squatted
When an operator takes it down with a reason
Then the org is withdrawn from public listings
And the action is audited with the operator and reason
```

**ORG-007-AC2** , non-operator cannot take down
```gherkin
Given I am not an operator admin
When I attempt to take down an org
Then I get 403 forbidden
```

---

## ORG-008 , Manage an org's scopes

- **Status:** [TODO]
- **Area:** Org / model
- **Test mode:** none
- **Traceability:** , (not yet built; OrgService attach/transfer/list scopes)

An org admin lists, attaches, and transfers the scopes their org owns. Attaching a
scope is subject to the anti-squat policy (`ORG-004..006`).

**ORG-008-AC1** , list an org's scopes
```gherkin
Given I am a member of org "acme" which owns "@acme" and "@acme-labs"
When I view the org's scopes
Then I see both "@acme" and "@acme-labs"
```

**ORG-008-AC2** , attach a new scope (admin only)
```gherkin
Given I am an admin of org "acme"
And scope "@acme-labs" is unclaimed and is verifiably mine
When I attach "@acme-labs" to org "acme"
Then org "acme" owns "@acme-labs"
```

**ORG-008-AC3** , non-admin cannot attach a scope
```gherkin
Given I am a non-admin member of org "acme"
When I attempt to attach a scope
Then I get 403 forbidden
```
