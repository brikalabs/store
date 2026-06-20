# Scopes

Every package on the registry lives under a **scope**: `@scope/name`. A scope is a
namespace owned by one identity (a person, team, or project), and you must **create a
scope before you can publish under it**. This is the same model as npm orgs: ownership is explicit, not granted by being
first to publish.

## Naming rules

A scope name is `@` followed by **2-20 characters**, using **lowercase letters, digits,
and hyphens** only, and may **not start with a hyphen**. Scope names are globally
unique.

| Example | Valid? | Why |
|---|---|---|
| `@brika` | yes | |
| `@my-team` | yes | hyphen allowed inside |
| `@a` | no | too short (min 2) |
| `@-team` | no | starts with a hyphen |
| `@Brika` | no | uppercase not allowed |
| `@brіka` | no | non-ASCII (the `і` here is Cyrillic) |

Rejecting uppercase and non-ASCII at creation time is deliberate: it stops a look-alike
scope (`@Brika`, or a homoglyph) from being registered next to a real one to impersonate
its owner.

The package name after the slash follows the manifest rule from `@brika/schema`:
lowercase letters, digits, and hyphens (`@scope/my-plugin`). Brika is scope-only, so
`@brika/schema` rejects an unscoped manifest name at build/publish time; its regex
mirrors the registry's canonical-name gate (`registry-core/names.ts`), so the two
never disagree.

The scope is also the publisher's public surface on the storefront: every scope has
a page at `store.brika.dev/@scope` listing its plugins with its verified-publisher
header, profile, and verified-domain badges. The scope is the account: there is no
separate "organisation" layer that owns scopes; a scope is a standalone account with
its own members.

## Creating a scope

With the CLI (after `brika login`):

```sh
brika scope create @my-team
```

Or directly against the registry with a publish credential:

```sh
curl -X PUT https://registry.brika.dev/-/scope/@my-team \
  -H "authorization: Bearer $BRIKA_TOKEN"
```

Creation is **idempotent**: creating a scope you already own succeeds (no-op). Creating
one owned by someone else fails with `409 Conflict`. The operation is race-safe, so two
people racing to create the same scope resolve to a single owner.

| Outcome | Status |
|---|---|
| Created and claimed for you | `201` |
| You already own it | `200` |
| Owned by someone else | `409` |
| Invalid scope name | `400` |
| No valid credential | `401` |

## Ownership and publishing

A scope is governed by its **members** (provider-qualified identities; today that is a
GitHub user or org, via OIDC trusted publishing or a device-flow token). Publishing is
gated on membership:

- Publishing to a scope that does not exist is rejected — **create it first**.
- Publishing to a scope you are not a member of is rejected (`403`).

So there is no way to publish under a scope you are not a member of, and no
first-publish race to claim one.

## Members and roles

A scope has members with one of two roles:

- **member** — may publish versions under the scope.
- **admin** — everything a member can, plus manage members and set the display name.

The creator is the scope's first **admin**. A scope always keeps **at least one admin**:
demoting or removing the last admin is rejected (`409`). All member management is
admin-only.

```sh
# List members (any member)
curl https://registry.brika.dev/-/scope/@brika/members -H "authorization: Bearer $TOKEN"

# Add or re-role a member (admin) - provider + id in the path, role in the body
curl -X PUT https://registry.brika.dev/-/scope/@brika/member/github/alice \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"role":"member"}'

# Remove a member (admin)
curl -X DELETE https://registry.brika.dev/-/scope/@brika/member/github/alice \
  -H "authorization: Bearer $TOKEN"
```

| Action | Status | Who |
|---|---|---|
| Add / re-role a member | `200` | admin |
| Remove a member | `200` | admin |
| List members | `200` | any member |
| Demote / remove the last admin | `409` | (rejected) |
| Not an admin / member | `403` | |

There is no separate invite-acceptance step yet: an admin adds a member directly by
`(provider, id)`. (Invitations are a possible later refinement.)

## Display name

A scope **admin** can set a public **display name** shown by the storefront as the
trusted publisher (e.g. "Brika Labs" for `@brika`), which overrides a manifest's
free-text `author`:

```sh
curl -X POST https://registry.brika.dev/-/scope/@brika/display-name \
  -H "authorization: Bearer $BRIKA_TOKEN" \
  -H "content-type: application/json" \
  -d '{"displayName":"Brika Labs"}'
```

`null` clears it (the owner id is shown instead).

## Reserved scopes

`@brika` and other official namespaces are reserved for the Brika team. Overly generic
scope names may be declined or reclaimed under the
[Acceptable Use Policy](../apps/web/src/content/legal/acceptable-use.md).
