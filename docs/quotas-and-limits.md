# Quotas and limits

The Brika registry applies quotas to keep the service healthy and to discourage
abuse (name squatting, spam, and accidental dumps of large binaries). They are
defaults, not hard ceilings: if you have a legitimate need for more, ask and we
will raise them (see [Requesting an increase](#requesting-an-increase)).

The numbers below are the single source of truth in
[`packages/registry-core/src/limits.ts`](../packages/registry-core/src/limits.ts)
(`REGISTRY_LIMITS`), so the publish path and this document never drift apart.

> Status note: today only the official `@brika` scope publishes to the registry;
> community scopes stay on npm until the community-publish milestone (see
> [`ROADMAP.md`](./ROADMAP.md)). The scope and user quotas below take effect when
> community publishing opens. The size limits apply now.

## Size limits

| Limit | Default | Enforced |
| --- | --- | --- |
| Gzipped tarball, per publish | 20 MiB | Yes, at `/-/publish` (HTTP `413` on exceed) |
| Any single file in a version | 8 MiB | Planned (requires unpacking the tarball) |
| Total uncompressed size of a version | 40 MiB | Planned (requires unpacking the tarball) |

The registry is for plugin **code**, not a CDN for production media. Ship icons,
a handful of screenshots, and your built source. If you are bundling large
binaries, that is almost always a mistake: reference external assets instead.

## Package limits

| Limit | Default | Enforced |
| --- | --- | --- |
| Published versions per package | 1000 | Planned (count check at publish) |

A published `name@version` is **immutable** and never overwritten. To pull a bad
version, `yank` it (hidden from new installs, still served to existing lockfiles)
or `deprecate` it (a warning, still installable). Hard deletion is reserved for
legal or security takedowns.

## Scope limits

A scope (for example `@brika`) is owned by a user or organization and linked to a
GitHub owner. Scope quotas exist to stop one account from hoarding namespace.

| Limit | Default | Window |
| --- | --- | --- |
| Packages a scope may contain | 100 | at any time |
| New packages created per scope | 20 | 7-day rolling |
| Publish attempts per scope | 1000 | 7-day rolling |

The weekly limits use a rolling window: a publish attempt or package creation
counts against the quota for `weeklyWindowDays` (7) days from when it happened.

## User limits

| Limit | Default |
| --- | --- |
| Scopes a single user may own | 3 |

This counts scopes you **own**, not ones where you are a member or admin. It
exists to prevent scope-name squatting; if you genuinely run more than three
projects under separate scopes, ask for an increase.

## Naming rules

- A package name is `@scope/name` (scoped) or `name` (unscoped), matching the
  `PluginPackageSchema` rule `^(@[a-z0-9-]+\/)?[a-z0-9-]+$`: lowercase ASCII
  letters, digits, and hyphens only.
- A scope name follows the same character rules and should represent a real
  user, organization, or project. Overly generic scope names (for example a
  single common word) may be declined or reclaimed under the
  [Acceptable Use Policy](../apps/web/src/content/legal/acceptable-use.md).
- Reserved scopes (`@brika` and other official namespaces) cannot be claimed.

## Request rate limits

`/-/publish`, the device-flow endpoints, and the resolve API sit behind
Cloudflare rate limiting and WAF rules. Automated clients that exceed the
per-IP request rate receive HTTP `429` and should back off and retry. Install
traffic (`GET` packument and tarball) is edge-cached and immutable, so it is not
rate limited in normal use.

## Requesting an increase

Quotas are soft. Email **quotas@brika.dev** with:

1. the affected scope, user, or package,
2. the quota you want raised and the new value you need, and
3. a short reason.

We would rather raise a limit than have it block real work.
