# Design: organisations, the scope model, and anti-squatting

Status: **Proposal** (no code yet). Tracks specs `ORG-001` .. `ORG-007`
(see [specs/org.md](./specs/org.md)). This doc records the decisions to react to
before the rename touches ~113 files and the D1 schema.

## Context

Today "scope" means two different things at once:

1. the **npm namespace** in a package name (`@brika/plugin-x`) , a fixed npm
   protocol concept, used by `bun add`, the packument, and publish; and
2. the **ownership / membership group** that owns that namespace (`reg_scopes`,
   `reg_scope_members`, `ScopeService`, the console "Scopes" pages).

Conflating them is confusing and blocks product features. We want:

- An **Organisation** ("org") as the first-class account/ownership entity.
- A public org page: **`store.brika.dev/org/:org`** listing the org's public
  plugins.
- A policy that stops a script from **squatting** (mass-claiming) names. Today
  there is none (claim is authenticated + first-come, but unthrottled, uncapped,
  and not tied to a verifiable identity).

## Decisions

### D1. Rename the entity to "organisation"; keep "scope" for the npm namespace

The ownership entity becomes **Organisation** everywhere it is a Brika concept:
domain (`ScopeService` -> `OrgService`), storage (`reg_scopes` -> `reg_orgs`,
`reg_scope_members` -> `reg_org_members`), the registry management API
(`/-/scope/:scope` -> `/-/org/:org`), and the console (routes, nav, UI text).

The word **"scope" is retained only for the npm namespace string** an org owns ,
i.e. in resolve / publish / packument / `isCanonicalScope`. That layer is npm
protocol and must not change, or `bun add @brika/x` breaks.

Rule of thumb: if a human owns/joins it, it is an **org**; if `bun` parses it out
of a package name, it is a **scope**.

### D2. An org owns one or more scopes (1:N) , DECIDED

An **organisation is a distinct entity** with its own slug, that can own **many**
npm scopes. Org `acme` (URL `/org/acme`) may own `@acme`, `@acme-labs`, etc.
Chosen because large orgs realistically run multiple namespaces under one team and
one membership list.

Model:

- `reg_orgs` , the org entity: `slug` (PK, e.g. `acme`), `displayName` (the
  verified-publisher label, now per-org and applied to all its scopes), `createdAt`.
- `reg_org_members` , membership moves onto the **org**: `(orgSlug, provider,
  memberId, role)`, roles `admin` / `member` (the last-admin invariant moves here).
- `reg_scopes` , keeps the npm-namespace rows but gains `orgId` (FK to
  `reg_orgs.slug`). A scope belongs to exactly one org; an org has many scopes.

Authorisation: publishing `@acme/x` is allowed when the caller is a member of the
org that owns scope `@acme` (`OwnershipPolicy` resolves scope -> org -> membership).

Two claim flows (vs one today): **create an org** (claim a slug, you become its
admin), then **attach/claim a scope** into an org you admin. Both the org slug and
each scope name are subject to the anti-squat policy (`ORG-004..006`). Managing an
org's scopes (list/attach/transfer) is `ORG-008`.

This is a **data-reshaping migration** (not just a rename): backfill one org per
existing scope (`@brika` -> org `brika`, display name "Brika Labs"; move its
members to the org; set `reg_scopes.orgId`). Larger than a 1:1 rename, but it is
the end state, so we do it once.

Public page (`ORG-003`) aggregates plugins across **all** the org's scopes.

### D3. Public organisation page

`store.brika.dev/org/:org` (SSR), listing the org's public, non-yanked,
non-taken-down plugins, with the verified display name and basic stats. Reuses the
existing catalog read path filtered by scope. Captured as `ORG-003`.

### D4. Anti-squatting policy (tiered)

Layer the controls; ship the cheap ones first, the strong one as the real fix.

- **`ORG-004` Claim rate limit.** Throttle the claim endpoint per authenticated
  principal using the existing `@brika/router` `rateLimit` + `cf()` binding (the
  same system that guards publish). E.g. 5 claims / hour / principal. Cheap, fits
  existing infra.
- **`ORG-005` Per-account cap.** A soft limit on orgs an account may hold (e.g.
  10), raisable on request. A count check in the claim use case. Stops slow-drip
  squatting that a rate limit alone allows.
- **`ORG-006` Identity-tied claiming (the real fix).** Publishing is already
  anchored on GitHub repo control via OIDC. Apply the same trust to claims: you
  may only claim an org/scope whose name matches a GitHub identity you provably
  control , your own login, or a GitHub org where you are an admin (verified via
  the GitHub API). Makes `@microsoft` unclaimable by a stranger, which rate limits
  and caps cannot. This is the npm/JSR-style anti-squat.
- **`ORG-007` Operator takedown of a squatted org.** Extend the existing
  version `takedown`/`restore` (admin-gated) to orgs, as a backstop for names that
  slip through.

Recommended commitment: `ORG-004` + `ORG-005` with the rename (low cost, immediate
abuse blunting), and `ORG-006` as a fast follow (it depends on a GitHub API call
in the claim path). `ORG-007` when an operator console exists.

## Migration sketch (when approved)

Mechanical rename is large but well-bounded (~113 files, 812 occurrences). Stage it:

1. **Schema + migration** (`packages/db`): add `reg_orgs` (slug, displayName,
   createdAt) and `reg_org_members` (orgSlug, provider, memberId, role); add
   `reg_scopes.orgId` (FK). Backfill: one org per existing scope (slug = scope
   without `@`), copy its `displayName`, move `reg_scope_members` rows to
   `reg_org_members`, set each scope's `orgId`. Then drop the now-moved columns
   from `reg_scopes` (`displayName`, owner) and the old `reg_scope_members` table.
   Adapters: `d1-org-store` + `d1-org-members` (own the membership + last-admin
   invariant), `d1-scope-*` keeps only the scope<->org link; `listScopesForMember`
   -> `listOrgsForMember`; add a scope-by-org reader for the public page.
2. **Domain** (`registry-core`): introduce `OrgService` (create org, members +
   roles, display name, attach/transfer scope) and `OrgMembers`; `OwnershipPolicy`
   resolves scope -> org -> membership. Keep `isCanonicalScope` and the
   npm-namespace types named "scope". The org slug gets its own
   `isCanonicalOrgSlug` validator.
3. **Registry API** (`apps/registry`): controller + routes `/-/scope` -> `/-/org`;
   audit actions `scope_*` -> `org_*`; `OwnershipPolicy` still resolves "is the
   caller a member of the org that owns this package's scope".
4. **Console** (`apps/web`): routes `dashboard.scopes*` -> `dashboard.orgs*`,
   `api.scopes*` -> `api.orgs*`, nav + copy; add the public `/org/:org` page.
5. **Specs**: the current `SCOPE-*` specs describe the implemented behaviour. On
   the rename they become `[GONE]` (renamed) and the behaviour is re-coded under
   `ORG-*` (codes are append-only, so we retire SCOPE rather than renumber). The
   new policy specs `ORG-004..007` are net-new.
6. **CLI / docs**: `brika` references and README/ROADMAP wording.

Compatibility: if any external client already calls `/-/scope/...`, keep a
short-lived alias route. The npm read surface (`/:name`, tarball, `/-/v1/...`) is
untouched.

## Open questions

1. ~~1:1 vs 1:N~~ , **DECIDED: 1:N** (D2). An org owns many scopes.
2. **Claim policy strength at launch** , is `ORG-006` (GitHub-verified claiming)
   required for the first cut, or do `ORG-004`/`005` suffice initially?
3. **Org slug namespace** , is the org slug independent of scope names (org
   `acme` could own `@acme` and `@widgets`), or must an org own a scope matching
   its slug? Recommendation: independent slug, but the FIRST scope you attach
   seeds the slug suggestion. Affects `ORG-006` (which name is identity-checked:
   the slug, each scope, or both , recommend both).
4. **Personal vs org** , is a solo developer's namespace also an "org", or a
   separate "personal account" concept? Recommendation: one concept (org); a
   personal org is just an org with one admin and one scope.
5. **Existing data** , `@brika` backfills to org `brika` (display name "Brika
   Labs") owning scope `@brika`; existing members move to the org. One-time
   migration, no behaviour change for current users.
