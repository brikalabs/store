# Scopes

Every package on the registry lives under a **scope**: `@scope/name`. A scope is a
namespace owned by one identity (a person, team, or project), and you must **create a
scope before you can publish under it**. This is the same model as npm orgs and
[JSR scopes](https://jsr.io/docs/scopes): ownership is explicit, not granted by being
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
lowercase letters, digits, and hyphens (`@scope/my-plugin`).

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

A scope is owned by the provider-qualified identity that created it (today that is a
GitHub user or org, via OIDC trusted publishing or a device-flow token). Publishing
enforces this:

- Publishing to a scope that does not exist is rejected — **create it first**.
- Publishing to a scope owned by a different identity is rejected (`403`).

So there is no way to publish a package under a scope you do not own, and no
first-publish race to claim one.

## Display name

A scope owner can set a public **display name** shown by the storefront as the trusted
publisher (e.g. "Brika Labs" for `@brika`), which overrides a manifest's free-text
`author`:

```sh
curl -X POST https://registry.brika.dev/-/scope/@brika/display-name \
  -H "authorization: Bearer $BRIKA_TOKEN" \
  -H "content-type: application/json" \
  -d '{"displayName":"Brika Labs"}'
```

Only the scope owner can set it; `null` clears it (the owner id is shown instead).

## Reserved scopes

`@brika` and other official namespaces are reserved for the Brika team. Overly generic
scope names may be declined or reclaimed under the
[Acceptable Use Policy](../apps/web/src/content/legal/acceptable-use.md).

## Planned

Today a scope has a single owner. **Multi-member scopes with roles** (admin/member,
inviting other accounts, "always at least one admin") are the planned next step, mirroring
the rest of the JSR model.
