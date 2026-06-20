# 1. Organisation entity owning many scopes (1:N)

- Status: Accepted
- Date: 2026-06-20
- Deciders: maxscharwath
- Specs: `ORG-001` .. `ORG-008` (see [docs/specs/org/](../specs/org/))

## Context and problem statement

Today "scope" means two things at once: the **npm namespace** in a package name
(`@brika/plugin-x`, a fixed npm-protocol concept used by `bun add`, the packument,
and publish) and the **ownership / membership group** that owns it (`reg_scopes`,
`reg_scope_members`, `ScopeService`, the console "Scopes" pages). Conflating them
is confusing and blocks features: a first-class account entity, a public
`store.brika.dev/org/:org` page, and a policy against name squatting (today claims
are authenticated but unthrottled, uncapped, and not tied to a verifiable identity).

## Decision drivers

- A large org realistically runs multiple namespaces under one team + one member list.
- The npm read surface must not change (`bun add @brika/x` cannot break).
- A public org page should aggregate an org's plugins.
- Squatting must be preventable (`@microsoft` should not be grabbable by a stranger).

## Considered options

1. **Rename only (1:1)** , one org == one scope, org slug = scope without `@`. Mostly
   mechanical, no new tables, but cannot model an org with several namespaces.
2. **Organisation entity owning many scopes (1:N)** , a distinct org with its own slug
   and membership, owning one or more scopes via a foreign key.
3. **No change** , keep "scope" doing both jobs. Rejected: blocks the org page and a
   coherent claim policy, and keeps the confusing dual meaning.

## Decision outcome

Chosen: **option 2 (1:N)**. An organisation is the first-class ownership entity; it
owns many scopes; "scope" is retained only for the npm namespace string.

Rule of thumb: if a human owns/joins it, it is an **org**; if `bun` parses it out of a
package name, it is a **scope**.

Model:

- `reg_orgs` , `slug` (PK, e.g. `acme`), `displayName` (the verified-publisher label,
  now per-org, applied to all its scopes), `createdAt`.
- `reg_org_members` , `(orgSlug, provider, memberId, role)`, roles `admin`/`member`
  (the last-admin invariant moves here).
- `reg_scopes` , keeps the npm-namespace rows, gains `orgId` (FK to `reg_orgs.slug`).
  A scope belongs to exactly one org; an org has many scopes.

Authorisation: publishing `@acme/x` is allowed when the caller is a member of the org
that owns scope `@acme` (`OwnershipPolicy` resolves scope -> org -> membership). Two
claim flows: create an org (claim a slug, become its admin), then attach/claim scopes
into an org you admin.

### Anti-squatting policy (tiered)

- `ORG-004` claim rate limit (reuse `@brika/router` `rateLimit` + `cf()`, like `HARDEN-001`).
- `ORG-005` per-account org cap (soft, raisable).
- `ORG-006` identity-tied claiming , you may only claim a name you provably control on
  GitHub (your login, or a GitHub org you admin), mirroring the OIDC trust publishing
  already uses. This is the real anti-squat; rate limits and caps cannot stop targeted
  grabs of valuable names.
- `ORG-007` operator takedown of a squatted org (extends the version takedown/restore).

Commitment: ship `ORG-004` + `ORG-005` with the rename; `ORG-006` as a fast follow
(needs a GitHub API call in the claim path); `ORG-007` when an operator console exists.

### Consequences

- A data-reshaping migration (not a pure rename): create `reg_orgs` + `reg_org_members`,
  add `reg_scopes.orgId`, backfill one org per existing scope (`@brika` -> org `brika`,
  display name "Brika Labs", move members), then drop the moved columns/table. One-time,
  no behaviour change for current users.
- Larger blast radius than 1:1 (~113 files mention "scope"), but it is the end state, so
  it is done once. The npm read surface is untouched; keep a short-lived `/-/scope` alias
  if any external client calls it.
- The currently-implemented behaviour specified as `SCOPE-*` becomes `gone` on the
  rename and is re-coded under `ORG-*` (codes are append-only).

## Migration sketch

1. **Schema** (`packages/db`): add `reg_orgs`, `reg_org_members`, `reg_scopes.orgId`;
   backfill; drop moved columns/old member table. Adapters `d1-org-store`/`d1-org-members`
   own membership + the last-admin invariant; add a scope-by-org reader for the org page.
2. **Domain** (`registry-core`): `OrgService` (create org, members + roles, display name,
   attach/transfer scope), `OrgMembers`; `OwnershipPolicy` resolves scope -> org. Keep
   `isCanonicalScope`; add `isCanonicalOrgSlug`.
3. **Registry API**: `/-/scope/*` -> `/-/org/*`; audit `scope_*` -> `org_*`.
4. **Console**: `dashboard.scopes*` -> `dashboard.orgs*`, `api.scopes*` -> `api.orgs*`,
   nav + copy; add public `/org/:org`.
5. **Specs**: retire `SCOPE-*` to `gone`; the behaviour lives under `ORG-*`.

## Open questions

1. **Claim policy at launch** , is `ORG-006` (GitHub-verified) required for the first
   cut, or do `ORG-004`/`005` suffice initially?
2. **Org slug namespace** , independent of scope names (recommended; the first attached
   scope seeds a slug suggestion), and is `ORG-006` checked on the slug, each scope, or
   both (recommend both)?
3. **Personal vs org** , one concept (a personal org is an org with one admin and one
   scope), recommended.
