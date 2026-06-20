---
id: HARDEN-010
title: "Operator-admin allowlist for takedown and restore"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/auth.ts
    - apps/registry/src/env.ts
  tests:
    - apps/registry/src/auth.test.ts
---

## Description

Operator takedown/restore is admin-gated, deliberately separate from (and overriding)
scope ownership, because the operator acts against the owner. `requireAdmin` resolves
a valid write credential, then checks its provider-qualified identity (`provider:owner`)
against the `REGISTRY_ADMINS` allowlist. Matching the full `provider:owner` keeps the
check correct once a second provider exists, so a `gitlab` user cannot inherit a
`github` admin's slot.

## Acceptance criteria

### HARDEN-010-AC1 , A valid credential not in the allowlist is forbidden
```gherkin
Given a request carries a valid write credential whose provider:owner is not in REGISTRY_ADMINS
When requireAdmin evaluates it
Then it throws 403 Forbidden
```

### HARDEN-010-AC2 , No valid credential is unauthorized, not forbidden
```gherkin
Given a request carries no valid write credential
When requireAdmin evaluates it
Then it throws 401 Unauthorized (distinct from the 403 for a non-admin)
```

### HARDEN-010-AC3 , The allowlist match is provider-qualified
```gherkin
Given REGISTRY_ADMINS contains github:octocat
And a request carries a valid credential for provider gitlab, owner octocat
When requireAdmin evaluates it
Then it throws 403 (the bare owner does not match across providers)
```
