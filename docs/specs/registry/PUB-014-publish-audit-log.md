---
id: PUB-014
title: "Publish audit log"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/publish.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Every publish attempt is recorded in the audit log (reg_audit), whether it succeeded or was
rejected, so the registry has a complete record of who attempted what.

## Acceptance criteria

### PUB-014-AC1 , A successful publish records a "publish" audit row
```gherkin
Given a publish that succeeds
When the attempt completes
Then an audit row is recorded with action "publish", the package name, version, and the actor identity
```

### PUB-014-AC2 , A rejected publish records a "publish_rejected" audit row with the failure
```gherkin
Given a publish rejected by any gate
When the attempt completes
Then an audit row is recorded with action "publish_rejected", the package name, version, the actor identity, and a detail carrying the error code and message
```
