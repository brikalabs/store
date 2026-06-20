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

### D2. An org's identity is its scope name, 1:1 (forward-compatible to 1:N)

Recommended starting model: **one org == one scope**, where the org slug is the
scope name without the `@` (org `brika` owns scope `@brika`). This is what today's
data already is (one scope, one owner group), so the rename is mostly mechanical:
no new join table, no ownership re-pointing.

It fully supports the public page: `/org/brika` resolves to scope `@brika` and
lists its plugins.

**Why not 1:N now:** a true "one org owns many scopes" model needs a separate
`reg_orgs` table, a `scope -> org` foreign key, membership moved onto the org, and
new UI to manage an org's scopes , a much larger migration. 1:1 keeps the door
open: the org entity exists after this work, so adding a `scope.orgId` FK later is
an additive migration, not a redesign.

**Open question for you:** do you foresee a single org needing multiple npm
namespaces (e.g. `@acme` and `@acme-labs`) soon? If yes, we plan the `reg_orgs`
table now to avoid a second migration. If "not soon", 1:1 is the cheaper path.
Captured as `ORG-002`.

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

1. **Schema + migration** (`packages/db`): `reg_scopes` -> `reg_orgs`,
   `reg_scope_members` -> `reg_org_members`; a drizzle migration that renames the
   tables/columns (no data reshape under D2's 1:1 model). Adapters
   `d1-scope-*` -> `d1-org-*`, `listScopesForMember` -> `listOrgsForMember`.
2. **Domain** (`registry-core`): `ScopeService` -> `OrgService`, `ScopeMembers`
   -> `OrgMembers`, `ScopeRecord`/`ScopeResult` -> `Org*`. Keep `isCanonicalScope`
   and the npm-namespace types named "scope".
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

1. **1:1 vs 1:N** (see D2) , the one decision that changes migration size.
2. **Claim policy strength at launch** , is `ORG-006` (GitHub-verified claiming)
   required for the first cut, or do `ORG-004`/`005` suffice initially?
3. **Existing `@brika` scope** , becomes org `brika` (verified publisher "Brika
   Labs"); no data change under 1:1.
4. **Personal vs org** , is a solo developer's namespace also an "org", or do we
   want a separate "personal account" concept? (npm has both; JSR treats all as
   scopes.) Recommendation: one concept (org) to start; a personal org is just an
   org with one admin.
