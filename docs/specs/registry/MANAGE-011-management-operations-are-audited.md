---
id: MANAGE-011
title: "Management operations are audited"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/manage.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Every management attempt is recorded in the audit log (reg_audit), accepted or rejected,
with the actor identity and the action, so the registry has a complete record of who
changed a version's visibility.

## Acceptance criteria

### MANAGE-011-AC1 , A successful management operation records an audit row
```gherkin
Given a successful deprecate, yank, unyank, takedown, or restore
When the attempt completes
Then an audit row is recorded with the matching action, the package name, version, and the actor identity
```

### MANAGE-011-AC2 , A rejected management operation records a rejected audit row
```gherkin
Given a management operation rejected by an ownership, admin, or existence gate
When the attempt completes
Then an audit row is recorded with the "<action>_rejected" action and a detail carrying the error code and message
```
