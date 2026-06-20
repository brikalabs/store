# Spec index

The full register of Brika specifications. Every feature has a stable code (see
the [README](./README.md) for the scheme and status legend). To check what is
built **and** still passing its tests, run:

```sh
bun run spec:coverage          # report
bun run spec:coverage --strict # non-zero exit on status drift (for CI)
```

The matrix below is the **declared** status (set from the code by a Senior BA).
The coverage script is the **verified** status (which criteria have a test citing
their code). They are intentionally separate: today the specs are authored from
the implemented code, and tagging the existing test suites with `-AC` codes is the
next step, so coverage starts at 0 and climbs as tests are annotated.

## Totals

130 specs , 355 acceptance criteria.

| Status | Count | Meaning |
| --- | --- | --- |
| `[DONE]` | 112 | Built (verified in code/tests or in-browser). |
| `[WIP]` | 2 | Partially built. |
| `[TODO]` | 14 | Specified, not built. |
| `[HOLD]` | 2 | Specified, blocked on operator credentials/deploy. |

> The `ORG-*` area is a **proposal** (the scope -> org rename, public org page,
> and anti-squatting policy). See [../org-model-design.md](../org-model-design.md)
> for the decisions to react to before implementation.

## What is NOT done yet (the backlog at a glance)

| Code | Status | Title |
| --- | --- | --- |
| STORE-012 | [WIP] | Marketplace redesign: Spotlight vs Console direction |
| CONSOLE-005 | [WIP] | Plugin listing-metadata editor (icon/locales/keywords) |
| STORE-013 | [TODO] | Verified publisher list signing (Ed25519) |
| STORE-014 | [TODO] | Scheduled npm sync (cron prewarm) |
| SOCIAL-010 | [TODO] | Author response to a review |
| SOCIAL-011 | [TODO] | Comment moderation |
| PUB-015 | [TODO] | Real malware scanner (behind the existing hook) |
| HARDEN-012 | [TODO] | Real malware scanner behind the hook |
| HARDEN-013 | [TODO] | Scheduled R2 + D1 backups |
| AUTH-009 | [HOLD] | OAuth app + secret configuration (operator) |
| HARDEN-014 | [HOLD] | Operator provisioning of hardening infrastructure |
| ORG-001 | [TODO] | Organisation is the ownership entity (rename of "scope") |
| ORG-002 | [TODO] | Org identity is its scope name (1:1, forward-compatible) |
| ORG-003 | [TODO] | Public organisation page (/org/:org) |
| ORG-004 | [TODO] | Claim rate limit |
| ORG-005 | [TODO] | Per-account org cap |
| ORG-006 | [TODO] | Identity-tied claiming (GitHub-verified) |
| ORG-007 | [TODO] | Operator takedown of a squatted org |

## AUTH , Authentication & sessions , [auth.md](./auth.md)

| Code | Status | Title |
| --- | --- | --- |
| AUTH-001 | [DONE] | GitHub OAuth sign-in: initiate |
| AUTH-002 | [DONE] | GitHub OAuth sign-in: callback |
| AUTH-003 | [DONE] | Stateless signed session: issue and verify |
| AUTH-004 | [DONE] | Open-redirect-safe return path |
| AUTH-005 | [DONE] | Who am I |
| AUTH-006 | [DONE] | Sign out |
| AUTH-007 | [DONE] | Server-side console auth guard |
| AUTH-008 | [DONE] | CLI device-authorization approval (store side) |
| AUTH-009 | [HOLD] | OAuth and secret configuration |

## STORE , Storefront & discovery , [store-storefront.md](./store-storefront.md)

| Code | Status | Title |
| --- | --- | --- |
| STORE-001 | [DONE] | Home / discover page |
| STORE-002 | [DONE] | Browse all plugins |
| STORE-003 | [DONE] | Plugin detail page |
| STORE-004 | [DONE] | Public developer profile |
| STORE-005 | [DONE] | Discovery: search endpoint |
| STORE-006 | [DONE] | Discovery: registry capabilities endpoint |
| STORE-007 | [DONE] | Discovery: plugin detail endpoint |
| STORE-008 | [DONE] | Discovery: version history endpoint |
| STORE-009 | [DONE] | Hybrid npm + registry federation |
| STORE-010 | [DONE] | Localized store copy, readme, and changelog |
| STORE-011 | [DONE] | Media and asset serving from the tarball |
| STORE-012 | [WIP] | Marketplace redesign: Spotlight vs Console direction |
| STORE-013 | [TODO] | Verified publisher list signing |
| STORE-014 | [TODO] | Scheduled npm sync (cron prewarm) |

## SOCIAL , Reviews, comments & grading , [store-social.md](./store-social.md)

| Code | Status | Title |
| --- | --- | --- |
| SOCIAL-001 | [DONE] | Write a review (auth-gated, rating plus body) |
| SOCIAL-002 | [DONE] | List reviews for a plugin |
| SOCIAL-003 | [DONE] | Plugin rating aggregate |
| SOCIAL-004 | [DONE] | Post a comment |
| SOCIAL-005 | [DONE] | List comments for a plugin |
| SOCIAL-006 | [DONE] | Grade a review (helpful vote) |
| SOCIAL-007 | [DONE] | Grade a comment (upvote) |
| SOCIAL-008 | [DONE] | Read the developer profile (data layer) |
| SOCIAL-009 | [DONE] | Update the developer profile (data layer) |
| SOCIAL-010 | [TODO] | Author response to a review |
| SOCIAL-011 | [TODO] | Comment moderation |

## REG , npm-compatible resolve, catalog & stats , [registry-resolve.md](./registry-resolve.md)

| Code | Status | Title |
| --- | --- | --- |
| REG-001 | [DONE] | Fetch full packument |
| REG-002 | [DONE] | Fetch abbreviated packument |
| REG-003 | [DONE] | Dist-tag resolution |
| REG-004 | [DONE] | Download tarball |
| REG-005 | [DONE] | Served tarball integrity matches recorded integrity |
| REG-006 | [DONE] | Record a download on tarball fetch |
| REG-007 | [DONE] | Yanked and taken-down versions hidden from resolve |
| REG-008 | [DONE] | Catalog list with pagination and text search |
| REG-009 | [DONE] | Catalog excludes yanked and taken-down packages |
| REG-010 | [DONE] | Per-package download stats |
| REG-011 | [DONE] | Tarball origin pinned to REGISTRY_URL |
| REG-012 | [DONE] | Open, CORS-frontable read surface |

## PUB , Publish pipeline , [registry-publish.md](./registry-publish.md)

| Code | Status | Title |
| --- | --- | --- |
| PUB-001 | [DONE] | Canonical scoped-name gate |
| PUB-002 | [DONE] | Manifest name/version must match the published name/version |
| PUB-003 | [DONE] | Ownership gate |
| PUB-004 | [DONE] | Tarball size limit |
| PUB-005 | [DONE] | Data/manifest gate (required metadata + bundled locales) |
| PUB-006 | [DONE] | Version immutability |
| PUB-007 | [DONE] | Malware/abuse scan hook |
| PUB-008 | [DONE] | Integrity computation |
| PUB-009 | [DONE] | Atomic R2 + D1 write with rollback |
| PUB-010 | [DONE] | GitHub Actions OIDC authentication |
| PUB-011 | [DONE] | Registry publish-token authentication |
| PUB-012 | [DONE] | Build provenance persistence |
| PUB-013 | [DONE] | Transparency-log attestation |
| PUB-014 | [DONE] | Publish audit log |
| PUB-015 | [TODO] | Real malware scanner |

## SCOPE , Scopes, membership & verified publisher , [registry-scopes.md](./registry-scopes.md)

| Code | Status | Title |
| --- | --- | --- |
| SCOPE-001 | [DONE] | Claim a new scope (creator becomes first admin) |
| SCOPE-002 | [DONE] | Re-claim a scope you already own (idempotent) |
| SCOPE-003 | [DONE] | Claim a scope owned by another (conflict) |
| SCOPE-004 | [DONE] | List members (member-gated) |
| SCOPE-005 | [DONE] | Add a member or change a role (admin only) |
| SCOPE-006 | [DONE] | Cannot demote the last admin (conflict) |
| SCOPE-007 | [DONE] | Remove a member (admin only; 404 non-member) |
| SCOPE-008 | [DONE] | Cannot remove the last admin (conflict) |
| SCOPE-009 | [DONE] | Set the verified publisher display name (admin only, validated) |
| SCOPE-010 | [DONE] | Display name overrides the manifest author in the packument |
| SCOPE-011 | [DONE] | Ownership policy gates publish by scope membership |
| SCOPE-012 | [DONE] | List the scopes I belong to (console read) |
| SCOPE-013 | [DONE] | Console session surface enforces the same scope rules |

## MANAGE , Version management, tokens & device flow , [registry-management.md](./registry-management.md)

| Code | Status | Title |
| --- | --- | --- |
| MANAGE-001 | [DONE] | Deprecate a version (owner) |
| MANAGE-002 | [DONE] | Un-deprecate a version (owner) |
| MANAGE-003 | [DONE] | A deprecated version stays installable |
| MANAGE-004 | [DONE] | Yank a version (owner) |
| MANAGE-005 | [DONE] | Un-yank a version (owner) |
| MANAGE-006 | [DONE] | Non-owner deprecate or yank is forbidden |
| MANAGE-007 | [DONE] | Deprecate or yank of a missing version is not found |
| MANAGE-008 | [DONE] | Operator takedown (admin-only) |
| MANAGE-009 | [DONE] | Restore a taken-down version (admin-only) |
| MANAGE-010 | [DONE] | Non-admin takedown or restore is forbidden |
| MANAGE-011 | [DONE] | Management operations are audited |
| MANAGE-012 | [DONE] | Web console deprecate and yank (session-auth, member-gated) |
| MANAGE-013 | [DONE] | Console version list with manage capability |
| MANAGE-014 | [DONE] | Issue a publish token (plaintext shown once) |
| MANAGE-015 | [DONE] | List my tokens (metadata only) |
| MANAGE-016 | [DONE] | Revoke my own token |
| MANAGE-017 | [DONE] | Cannot revoke another user's token |
| MANAGE-018 | [DONE] | Token verification and expiry |
| MANAGE-019 | [DONE] | Device-code request (RFC 8628) |
| MANAGE-020 | [DONE] | Device-token poll and redeem |
| MANAGE-021 | [DONE] | Revoke a device-issued token (Bearer) |

## HARDEN , Abuse, integrity & operational hardening (M6) , [registry-hardening.md](./registry-hardening.md)

| Code | Status | Title |
| --- | --- | --- |
| HARDEN-001 | [DONE] | Publish rate limit, keyed by authenticated principal |
| HARDEN-002 | [DONE] | Device-code rate limit, keyed by unspoofable client IP |
| HARDEN-003 | [DONE] | Device-token polling is deliberately not rate limited |
| HARDEN-004 | [DONE] | In-memory rate-limit fallback when the Workers binding is absent |
| HARDEN-005 | [DONE] | Tarball-origin pinning (no Host trust) |
| HARDEN-006 | [DONE] | Asset path-traversal guard on the store asset endpoint |
| HARDEN-007 | [DONE] | Scoped read-only CORS on the registry read surface |
| HARDEN-008 | [DONE] | Append-only audit log for every mutating action |
| HARDEN-009 | [DONE] | Audit writes are best-effort and never fail a committed action |
| HARDEN-010 | [DONE] | Operator-admin allowlist for takedown and restore |
| HARDEN-011 | [DONE] | Malware-scan hook seam in the publish pipeline |
| HARDEN-012 | [TODO] | Real malware scanner behind the hook |
| HARDEN-013 | [TODO] | Scheduled R2 + D1 backups |
| HARDEN-014 | [HOLD] | Operator provisioning of hardening infrastructure |

## CONSOLE , Developer dashboard , [console.md](./console.md)

| Code | Status | Title |
| --- | --- | --- |
| CONSOLE-001 | [DONE] | Server-side auth guard and login redirect |
| CONSOLE-002 | [DONE] | Overview page and plugin stat cards |
| CONSOLE-003 | [DONE] | My plugins list |
| CONSOLE-004 | [DONE] | Plugin editor version management (deprecate / yank) |
| CONSOLE-005 | [WIP] | Plugin listing-metadata editor |
| CONSOLE-006 | [DONE] | Scopes list |
| CONSOLE-007 | [DONE] | Claim a scope |
| CONSOLE-008 | [DONE] | Scope members management UI |
| CONSOLE-009 | [DONE] | Verified display-name editor (admin-only) |
| CONSOLE-010 | [DONE] | API tokens list, create-once, and revoke |
| CONSOLE-011 | [DONE] | Sign-out |
| CONSOLE-012 | [DONE] | Profile editor |
| CONSOLE-013 | [DONE] | Shared-domain authorization over D1 (401 when unauthenticated) |
| CONSOLE-014 | [DONE] | Local-dev registry schema setup (db:setup:local) |

## ORG , Organisations & anti-squatting (proposal) , [org.md](./org.md)

| Code | Status | Title |
| --- | --- | --- |
| ORG-001 | [TODO] | Organisation is the ownership entity (rename of "scope") |
| ORG-002 | [TODO] | Org identity is its scope name (1:1, forward-compatible to 1:N) |
| ORG-003 | [TODO] | Public organisation page |
| ORG-004 | [TODO] | Claim rate limit |
| ORG-005 | [TODO] | Per-account org cap |
| ORG-006 | [TODO] | Identity-tied claiming (GitHub-verified) |
| ORG-007 | [TODO] | Operator takedown of a squatted org |
