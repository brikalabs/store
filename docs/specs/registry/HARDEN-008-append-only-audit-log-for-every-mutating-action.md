---
id: HARDEN-008
title: "Append-only audit log for every mutating action"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/d1-audit.ts
  tests:
    - packages/db/src/adapters/d1-audit.test.ts
---

## Description

Every mutating action (publish, deprecate, yank, takedown, restore, scope_*) appends
a row to the append-only `reg_audit` table with the action, package, version, the
resolved actor (CI publishes attributed to the repo, local ones to the owner), and an
optional detail blob. The trail is never updated or deleted in place.

## Acceptance criteria

### HARDEN-008-AC1 , A successful mutating action writes an audit row
```gherkin
Given a publish (or deprecate, yank, takedown, restore, scope_* action) commits
When the action completes
Then a reg_audit row is appended recording the action, package name, version, and actor
```

### HARDEN-008-AC2 , The actor is the repository for CI and the owner otherwise
```gherkin
Given a publish authenticated by GitHub Actions OIDC carrying a repository
When its audit row is written
Then the actor column holds the repository
Given a publish authenticated by a local publish token with no repository
When its audit row is written
Then the actor column holds the token owner
```
