---
id: MANAGE-008
title: "Operator takedown (admin-only)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/manage.ts
    - apps/registry/src/controllers/manage.ts
    - apps/registry/src/auth.ts
    - apps/registry/src/env.ts
  tests:
    - packages/registry-core/src/manage.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

A platform operator removes a version for policy or legal reasons. Takedown is admin-only
(the caller must be in the REGISTRY_ADMINS allowlist) and existence-gated, not
ownership-gated: an operator can take down any existing version regardless of who owns it.
Like a yank, the version is hidden from installs and the catalog and the bytes are kept,
but the reason (max 1024 chars) is surfaced publicly in the packument "takedowns" map.

## Acceptance criteria

### MANAGE-008-AC1 , An admin takes down any existing version with a public reason
```gherkin
Given an existing version name@version
And an authenticated caller in the REGISTRY_ADMINS allowlist (need not own the scope)
When the caller POSTs /-/package/:name/:version/takedown with { reason: "<text>" }
Then the result is ok and the endpoint responds 200
And reading the packument no longer lists the version in its "versions" map
And the packument "takedowns" map maps the version to the supplied reason
```

### MANAGE-008-AC2 , Taking down a version that does not exist returns not found
```gherkin
Given a name@version that does not exist in the registry
And an authenticated caller in the REGISTRY_ADMINS allowlist
When the caller POSTs /-/package/:name/:version/takedown
Then the result is not ok with code "not_found"
And the endpoint responds 404
```
